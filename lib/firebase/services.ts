import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { deleteField, arrayRemove } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "./config";
import type {
  AppUser,
  Restaurant,
  MenuProduct,
  Order,
  CustomerQuery,
  UserRole,
  QueryStatus,
  OrderStatus,
  QueryRemark,
} from "@/lib/types";

// ─── Auth ──────────────────────────────────────────────────────────────────────
export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  return signOut(auth);
}

export async function changeUserPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No authenticated user");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return updatePassword(user, newPassword);
}

export async function createUserAccount(
  email: string,
  password: string,
  associatedRestaurant: string | null = null
): Promise<string> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setUserDoc(cred.user.uid, {
    uid: cred.user.uid,
    email,
    managed_restaurant: associatedRestaurant,
    created_at: serverTimestamp() as Timestamp,
  });
  return cred.user.uid;
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export async function getUserDoc(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "realtime-users", uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}

export async function setUserDoc(uid: string, data: Partial<AppUser>) {
  return setDoc(doc(db, "realtime-users", uid), data, { merge: true });
}

export async function getUsersByRole(role: "customer"): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, "realtime-users"));
  return snap.docs
    .map((d) => d.data() as AppUser)
    .filter((u) => !u.managed_restaurant);
}

// ─── Restaurants ───────────────────────────────────────────────────────────────
export async function getAllRestaurants(): Promise<Restaurant[]> {
  const snap = await getDocs(collection(db, "restaurants"));
  return snap.docs.map((d) => d.data() as Restaurant);
}

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const snap = await getDoc(doc(db, "restaurants", id));
  return snap.exists() ? (snap.data() as Restaurant) : null;
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const q = query(collection(db, "restaurants"), where("url_slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Restaurant;
}

export async function createRestaurant(restaurantData: any) {
  const restaurantRef = doc(collection(db, "restaurants"));
  const restaurantId = restaurantRef.id;

  await setDoc(restaurantRef, {
    ...restaurantData,
    restaurant_id: restaurantId,
    admin_uid: null,
    admin_email: null,
    manager_uids: [],
    created_at: serverTimestamp(),
  });

  return restaurantId;
}

export async function updateRestaurant(id: string, data: Partial<Restaurant>) {
  return updateDoc(doc(db, "restaurants", id), data);
}

export async function deleteRestaurant(id: string) {
  return deleteDoc(doc(db, "restaurants", id));
}

// ─── DYNAMIC ROLE COMPUTATION ───────────────────────────────────────────────────

export type EffectiveRole = "restaurant_admin" | "restaurant_manager" | "admin_and_manager" | "none";


/**
 * Given a restaurant doc and a uid, compute the role dynamically.
 * No stored role field — always derived from admin_uid / manager_uids.
 */
export function computeRoleForRestaurant(
  restaurant: Restaurant | null,
  uid: string
): EffectiveRole {
  if (!restaurant || !uid) return "none";

  const isAdmin = restaurant.admin_uid === uid;
  const isManager = (restaurant.manager_uids || []).includes(uid);

  if (isAdmin && isManager) return "admin_and_manager";
  if (isAdmin) return "restaurant_admin";
  if (isManager) return "restaurant_manager";
  return "none";
}

/**
 * Fetch a user's effective role by reading their managed_restaurant pointer,
 * then evaluating that restaurant's admin_uid / manager_uids against their uid.
 * This is the single source of truth — call this instead of trusting any
 * cached "role" field.
 */
export async function getEffectiveRole(
  uid: string,
  managedRestaurantId: string | null | undefined
): Promise<{ role: EffectiveRole; restaurant: Restaurant | null }> {
  if (!managedRestaurantId) {
    return { role: "none", restaurant: null };
  }

  const restaurant = await getRestaurant(managedRestaurantId);
  const role = computeRoleForRestaurant(restaurant, uid);
  return { role, restaurant };
}

// ─── ASSIGNMENT (with cross-restaurant confirmation) ────────────────────────────

export interface AssignRoleResult {
  success: boolean;
  message: string;
  uid?: string;
  isNewUser?: boolean;
  role?: string;
  needsConfirmation?: boolean;
  conflictRestaurantId?: string;
  conflictRestaurantName?: string;
  targetRestaurantName?: string;
}

export interface UserWithComputedRole extends AppUser {
  effectiveRole: "restaurant_admin" | "restaurant_manager" | "admin_and_manager" | "customer";
}

/**
 * ASSIGN RESTAURANT ROLE (admin or manager)
 *
 * First call (confirmed = false, the default): if the target user is already
 * tied to a DIFFERENT restaurant, the API returns needsConfirmation = true
 * instead of making changes. Show that to the user, then call again with
 * confirmed = true to actually revoke the old ties and proceed.
 */
export async function assignRestaurantRole(
  email: string,
  restaurantId: string,
  role: "restaurant_admin" | "restaurant_manager",
  confirmed = false
): Promise<AssignRoleResult> {
  try {
    if (!email || !restaurantId) {
      throw new Error("Email and restaurant ID are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error("Invalid email format");
    }

    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantDoc = await getDoc(restaurantRef);
    if (!restaurantDoc.exists()) {
      throw new Error("Restaurant not found");
    }

    const response = await fetch("/api/admin/assign-restaurant-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        restaurantId,
        role,
        confirmed,
      }),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Server error (status ${response.status}). Check server logs.`);
    }

    // 409 = needs confirmation, not a hard failure — surface it to the caller
    if (response.status === 409 && data.needsConfirmation) {
      return {
        success: false,
        needsConfirmation: true,
        message: data.message,
        conflictRestaurantId: data.conflictRestaurantId,
        conflictRestaurantName: data.conflictRestaurantName,
        targetRestaurantName: data.targetRestaurantName,
      };
    }

    if (!response.ok) {
      throw new Error(data.message || "Failed to assign role");
    }

    // Server route only writes manager_uids — record the join date client-side
    // so it can be shown on the managers dashboard.
    if (role === "restaurant_manager" && data.uid) {
      try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
          [`manager_assigned_at.${data.uid}`]: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Failed to record manager_assigned_at:", e);
        // non-fatal — the assignment itself already succeeded
      }
    }

    return {
      success: true,
      message: data.message,
      uid: data.uid,
      isNewUser: data.isNewUser,
      role: data.role,
    };
  } catch (error: any) {
    console.error("❌ assignRestaurantRole error:", error.message);
    throw new Error(error.message || "An error occurred while assigning role");
  }
}

/**
 * UNASSIGN ADMIN — clears admin_uid/admin_email on the restaurant.
 * If the (now former) admin isn't also a manager there, release their
 * managed_restaurant pointer entirely.
 */
export async function unassignRestaurantAdmin(restaurantId: string): Promise<void> {
  const restaurantRef = doc(db, "restaurants", restaurantId);
  const restaurantDoc = await getDoc(restaurantRef);
  if (!restaurantDoc.exists()) throw new Error("Restaurant not found");
 
  const data = restaurantDoc.data();
  const adminUid = data?.admin_uid;
  const adminEmail = data?.admin_email;
 
  await updateDoc(restaurantRef, {
    admin_uid: null,
    admin_email: null,
    updated_at: new Date(),
  });
 
  if (adminEmail && adminUid) {
    const stillManager = (data?.manager_uids || []).includes(adminUid);
    if (!stillManager) {
      const userRef = doc(db, "realtime-users", adminEmail);
      await updateDoc(userRef, {
        managed_restaurant: null,
        updated_at: new Date(),
      });
    }
  }
}

/**
 * UNASSIGN MANAGER — removes uid from manager_uids.
 * If they're not also the admin there, release their managed_restaurant pointer.
 */
export async function unassignRestaurantManager(
  restaurantId: string,
  managerUid: string,
  managerEmail: string
): Promise<void> {
  const restaurantRef = doc(db, "restaurants", restaurantId);
  const restaurantDoc = await getDoc(restaurantRef);
  if (!restaurantDoc.exists()) throw new Error("Restaurant not found");

  const data = restaurantDoc.data();
  const managerUids: string[] = data?.manager_uids || [];

  if (!managerUids.includes(managerUid)) {
    throw new Error("User is not a manager of this restaurant");
  }

  await updateDoc(restaurantRef, {
    manager_uids: managerUids.filter((id) => id !== managerUid),
    [`manager_assigned_at.${managerUid}`]: deleteField(),
    updated_at: new Date(),
  });

  const isAlsoAdmin = data?.admin_uid === managerUid;
  if (!isAlsoAdmin) {
    const userRef = doc(db, "realtime-users", managerEmail);
    await updateDoc(userRef, {
      managed_restaurant: null,
      updated_at: new Date(),
      roles: arrayRemove("restaurant_manager"),
    });
  }
}

/**
 * GET ALL STAFF FOR A RESTAURANT (admin + managers), each tagged with their
 * dynamically-computed role.
 */
export async function getRestaurantStaff(restaurantId: string): Promise<{
  admin: (AppUser & { effectiveRole: EffectiveRole }) | null;
  managers: (AppUser & { effectiveRole: EffectiveRole })[];
}> {
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant) return { admin: null, managers: [] };

  let admin: (AppUser & { effectiveRole: EffectiveRole }) | null = null;
  if (restaurant.admin_email) {
    const adminSnap = await getDoc(doc(db, "realtime-users", restaurant.admin_email));
    if (adminSnap.exists()) {
      const adminData = adminSnap.data() as AppUser;
      admin = {
        ...adminData,
        effectiveRole: computeRoleForRestaurant(restaurant, adminData.uid),
      };
    }
  }

  const managerUids: string[] = restaurant.manager_uids || [];
  const managers: (AppUser & { effectiveRole: EffectiveRole })[] = [];

  if (managerUids.length > 0) {
    // realtime-users is keyed by email, so we scan for matching uids.
    // For larger user bases, store an email lookup or a uid-indexed collection instead.
    const snap = await getDocs(collection(db, "realtime-users"));
    snap.docs.forEach((d) => {
      const u = d.data() as AppUser;
      if (managerUids.includes(u.uid)) {
        managers.push({ ...u, effectiveRole: computeRoleForRestaurant(restaurant, u.uid) });
      }
    });
  }

  return { admin, managers };
}

export async function getManagersByRestaurant(restaurantId: string): Promise<AppUser[]> {
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant) return [];
 
  const managerUids = restaurant.manager_uids || [];
  if (managerUids.length === 0) return [];
 
  const chunks: string[][] = [];
  for (let i = 0; i < managerUids.length; i += 30) {
    chunks.push(managerUids.slice(i, i + 30));
  }
 
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, "realtime-users"), where("uid", "in", chunk)))
    )
  );
 
  return snapshots.flatMap((snap) => snap.docs.map((d) => d.data() as AppUser));
}

/**
 * ═══════════════════════════════════════════════════════════════
 * GET / FETCH FUNCTIONS
 * ═══════════════════════════════════════════════════════════════
 */
 
/**
 * GET ALL MENU PRODUCTS WITH PAGINATION
 */

const DEFAULT_PRODUCTS_LIMIT = 12;

export async function getMenuProducts(
  restaurantId: string,
  lastDoc?: any,
  pageSize: number = DEFAULT_PRODUCTS_LIMIT
): Promise<{ products: MenuProduct[]; lastDoc: any; hasMore: boolean }> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    let q: Query;
 
    if (lastDoc) {
      // Pagination: start after last document
      q = query(
        colRef,
        orderBy("created_at", "desc"),
        startAfter(lastDoc),
        limit(pageSize + 1) // +1 to check if more docs exist
      );
    } else {
      // First page
      q = query(
        colRef,
        orderBy("created_at", "desc"),
        limit(pageSize + 1)
      );
    }
 
    const snap = await getDocs(q);
    const docs = snap.docs;
 
    // Check if there are more products
    const hasMore = docs.length > pageSize;
    const productsData = docs
      .slice(0, pageSize)
      .map((d) => d.data() as MenuProduct);
 
    const newLastDoc = productsData.length > 0
      ? snap.docs[Math.min(pageSize - 1, docs.length - 1)]
      : null;
 
    return {
      products: productsData,
      lastDoc: newLastDoc,
      hasMore,
    };
  } catch (error: any) {
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("no index")
    ) {
      return { products: [], lastDoc: null, hasMore: false };
    }
 
    console.error("❌ getMenuProducts error:", error.message);
    throw error;
  }
}
 
/**
 * GET SINGLE PRODUCT BY ID
 */
export async function getMenuProduct(
  restaurantId: string,
  productId: string
): Promise<MenuProduct | null> {
  try {
    if (!restaurantId || !productId) {
      throw new Error("Restaurant ID and product ID are required");
    }
 
    const docRef = doc(
      db,
      "restaurants",
      restaurantId,
      "menu-products",
      productId
    );
 
    const snap = await getDoc(docRef);
 
    if (!snap.exists()) {
      return null;
    }
 
    return snap.data() as MenuProduct;
  } catch (error: any) {
    console.error("❌ getMenuProduct error:", error.message);
    throw error;
  }
}
 
/**
 * SEARCH MENU PRODUCTS BY CATEGORY
 */
export async function searchMenuProducts(
  restaurantId: string,
  filters?: {
    category?: string;
    isAvailable?: boolean;
  }
): Promise<MenuProduct[]> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    let constraints = [orderBy("created_at", "desc")];
 
    if (filters?.category) {
      constraints.push(where("category", "==", filters.category));
    }
 
    if (filters?.isAvailable !== undefined) {
      constraints.push(where("is_available", "==", filters.isAvailable));
    }
 
    const q = query(colRef, ...constraints);
    const snap = await getDocs(q);
 
    return snap.docs.map((d) => d.data() as MenuProduct);
  } catch (error: any) {
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("no index")
    ) {
      return [];
    }
 
    console.error("❌ searchMenuProducts error:", error.message);
    throw error;
  }
}
 
/**
 * GET AVAILABLE PRODUCTS WITH PAGINATION
 */
export async function getAvailableProducts(
  restaurantId: string,
  pageSize: number = DEFAULT_PRODUCTS_LIMIT
): Promise<MenuProduct[]> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    const q = query(
      colRef,
      where("is_available", "==", true),
      orderBy("created_at", "desc"),
      limit(pageSize)
    );
 
    const snap = await getDocs(q);
 
    return snap.docs.map((d) => d.data() as MenuProduct);
  } catch (error: any) {
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("no index")
    ) {
      return [];
    }
 
    console.error("❌ getAvailableProducts error:", error.message);
    throw error;
  }
}
 
/**
 * GET PRODUCTS BY CATEGORY
 */
export async function getProductsByCategory(
  restaurantId: string,
  category: string,
  pageSize: number = DEFAULT_PRODUCTS_LIMIT
): Promise<MenuProduct[]> {
  try {
    if (!restaurantId || !category) {
      throw new Error("Restaurant ID and category are required");
    }
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    const q = query(
      colRef,
      where("category", "==", category),
      orderBy("created_at", "desc"),
      limit(pageSize)
    );
 
    const snap = await getDocs(q);
 
    return snap.docs.map((d) => d.data() as MenuProduct);
  } catch (error: any) {
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("no index")
    ) {
      return [];
    }
 
    console.error("❌ getProductsByCategory error:", error.message);
    throw error;
  }
}
 
/**
 * GET PRODUCT COUNT
 */
export async function getProductCount(
  restaurantId: string
): Promise<number> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    const snap = await getDocs(colRef);
 
    return snap.size;
  } catch (error: any) {
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("no index")
    ) {
      return 0;
    }
 
    console.error("❌ getProductCount error:", error.message);
    return 0;
  }
}
 
/**
 * ═══════════════════════════════════════════════════════════════
 * CREATE FUNCTIONS
 * ═══════════════════════════════════════════════════════════════
 */
 
/**
 * CREATE SINGLE MENU PRODUCT
 */
export async function createMenuProduct(
  restaurantId: string,
  data: Omit<MenuProduct, "product_id" | "created_at" | "updated_at">
): Promise<string> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    if (!data.name) {
      throw new Error("Product name is required");
    }
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    const docRef = doc(colRef);
    const productId = docRef.id;
 
    // ✅ FIXED: Use is_available instead of available
    await setDoc(docRef, {
      ...data,
      product_id: productId,
      is_available: data.is_available ?? true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
 
    console.log(
      `✅ Product created: ${productId} in restaurant ${restaurantId}`
    );
 
    return productId;
  } catch (error: any) {
    console.error("❌ createMenuProduct error:", error.message);
    throw new Error(error.message || "Failed to create menu product");
  }
}
 
/**
 * CREATE MULTIPLE MENU PRODUCTS (BATCH)
 */
export async function createMenuProductsBatch(
  restaurantId: string,
  productsData: Omit<MenuProduct, "product_id" | "created_at" | "updated_at">[]
): Promise<string[]> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    if (productsData.length === 0) {
      throw new Error("At least one product is required");
    }
 
    if (productsData.length > 500) {
      throw new Error("Cannot create more than 500 products at once");
    }
 
    const batch = writeBatch(db);
    const productIds: string[] = [];
 
    const colRef = collection(
      db,
      "restaurants",
      restaurantId,
      "menu-products"
    );
 
    productsData.forEach((data) => {
      const docRef = doc(colRef);
      const productId = docRef.id;
 
      // ✅ FIXED: Use is_available instead of available
      batch.set(docRef, {
        ...data,
        product_id: productId,
        is_available: data.is_available ?? true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
 
      productIds.push(productId);
    });
 
    await batch.commit();
 
    console.log(
      `✅ Batch created ${productIds.length} products in restaurant ${restaurantId}`
    );
 
    return productIds;
  } catch (error: any) {
    console.error("❌ createMenuProductsBatch error:", error.message);
    throw new Error(error.message || "Failed to create menu products batch");
  }
}
 
/**
 * ═══════════════════════════════════════════════════════════════
 * UPDATE FUNCTIONS
 * ═══════════════════════════════════════════════════════════════
 */
 
/**
 * UPDATE SINGLE MENU PRODUCT
 */
export async function updateMenuProduct(
  restaurantId: string,
  productId: string,
  data: Partial<MenuProduct>
): Promise<void> {
  try {
    if (!restaurantId || !productId) {
      throw new Error("Restaurant ID and product ID are required");
    }
 
    const docRef = doc(
      db,
      "restaurants",
      restaurantId,
      "menu-products",
      productId
    );
 
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Product not found: ${productId}`);
    }
 
    await updateDoc(docRef, {
      ...data,
      updated_at: serverTimestamp(),
    });
 
    console.log(
      `✅ Product updated: ${productId} in restaurant ${restaurantId}`
    );
  } catch (error: any) {
    console.error("❌ updateMenuProduct error:", error.message);
    throw error;
  }
}
 
/**
 * UPDATE MULTIPLE PRODUCTS (BATCH)
 */
export async function updateMenuProductsBatch(
  restaurantId: string,
  updates: { productId: string; data: Partial<MenuProduct> }[]
): Promise<void> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    if (updates.length === 0) {
      throw new Error("At least one product update is required");
    }
 
    if (updates.length > 500) {
      throw new Error("Cannot update more than 500 products at once");
    }
 
    const batch = writeBatch(db);
 
    updates.forEach(({ productId, data }) => {
      const docRef = doc(
        db,
        "restaurants",
        restaurantId,
        "menu-products",
        productId
      );
 
      batch.update(docRef, {
        ...data,
        updated_at: serverTimestamp(),
      });
    });
 
    await batch.commit();
 
    console.log(
      `✅ Batch updated ${updates.length} products in restaurant ${restaurantId}`
    );
  } catch (error: any) {
    console.error("❌ updateMenuProductsBatch error:", error.message);
    throw error;
  }
}
 
/**
 * TOGGLE PRODUCT AVAILABILITY
 * ✅ FIXED: Now uses is_available field
 */
export async function toggleProductAvailability(
  restaurantId: string,
  productId: string,
  is_available: boolean
): Promise<void> {
  try {
    if (!restaurantId || !productId) {
      throw new Error("Restaurant ID and product ID are required");
    }
 
    const docRef = doc(
      db,
      "restaurants",
      restaurantId,
      "menu-products",
      productId
    );
 
    await updateDoc(docRef, {
      is_available,
      updated_at: serverTimestamp(),
    });
 
    console.log(
      `✅ Product availability updated: ${productId} → ${
        is_available ? "available" : "unavailable"
      }`
    );
  } catch (error: any) {
    console.error("❌ toggleProductAvailability error:", error.message);
    throw error;
  }
}
 
/**
 * ═══════════════════════════════════════════════════════════════
 * DELETE FUNCTIONS
 * ═══════════════════════════════════════════════════════════════
 */
 
/**
 * DELETE SINGLE MENU PRODUCT
 */
export async function deleteMenuProduct(
  restaurantId: string,
  productId: string
): Promise<void> {
  try {
    if (!restaurantId || !productId) {
      throw new Error("Restaurant ID and product ID are required");
    }
 
    const docRef = doc(
      db,
      "restaurants",
      restaurantId,
      "menu-products",
      productId
    );
 
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Product not found: ${productId}`);
    }
 
    await deleteDoc(docRef);
 
    console.log(
      `✅ Product deleted: ${productId} from restaurant ${restaurantId}`
    );
  } catch (error: any) {
    console.error("❌ deleteMenuProduct error:", error.message);
    throw error;
  }
}
 
/**
 * DELETE MULTIPLE PRODUCTS (BATCH)
 */
export async function deleteMenuProductsBatch(
  restaurantId: string,
  productIds: string[]
): Promise<void> {
  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
 
    if (productIds.length === 0) {
      throw new Error("At least one product ID is required");
    }
 
    if (productIds.length > 500) {
      throw new Error("Cannot delete more than 500 products at once");
    }
 
    const batch = writeBatch(db);
 
    productIds.forEach((productId) => {
      const docRef = doc(
        db,
        "restaurants",
        restaurantId,
        "menu-products",
        productId
      );
 
      batch.delete(docRef);
    });
 
    await batch.commit();
 
    console.log(
      `✅ Batch deleted ${productIds.length} products from restaurant ${restaurantId}`
    );
  } catch (error: any) {
    console.error("❌ deleteMenuProductsBatch error:", error.message);
    throw error;
  }
}

export async function uploadProductImage(
  restaurantId: string,
  productId: string,
  file: File
): Promise<string> {
  const storageRef = ref(storage, `restaurants/${restaurantId}/products/${productId}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ─── Orders ────────────────────────────────────────────────────────────────────
export async function getRestaurantOrders(
  restaurantId: string,
  limitCount: number = 100
): Promise<Order[]> {
  try {
    const q = query(
      collection(db, "restaurants", restaurantId, "orders"),
      orderBy("created_at", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), order_id: d.id } as Order));
  } catch (error) {
    console.error("Error fetching restaurant orders:", error);
    return [];
  }
}

/**
 * Get customer's orders at a specific restaurant
 * WHERE customer_id == customerId at restaurants/{restaurantId}/orders
 */
export async function getCustomerRestaurantOrders(
  restaurantId: string,
  customerId: string,
  limitCount: number = 50
): Promise<Order[]> {
  try {
    const q = query(
      collection(db, "restaurants", restaurantId, "orders"),
      where("customer_id", "==", customerId),
      orderBy("created_at", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), order_id: d.id } as Order));
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return [];
  }
}

/**
 * Get single order by ID (FASTEST)
 * Direct document read: restaurants/{restaurantId}/orders/{orderId}
 */
export async function getOrderById(
  restaurantId: string,
  orderId: string
): Promise<Order | null> {
  try {
    const docRef = doc(db, "restaurants", restaurantId, "orders", orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { ...snap.data(), order_id: snap.id } as Order;
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
}

/**
 * Create a new order
 * Data should NOT include: order_id, created_at, updated_at (auto-generated)
 */
export async function createOrder(
  restaurantId: string,
  data: Omit<Order, "order_id" | "created_at" | "updated_at">
): Promise<string> {
  try {
    const colRef = collection(db, "restaurants", restaurantId, "orders");
    const docRef = await addDoc(colRef, {
      ...data,
      created_at: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  status: OrderStatus
): Promise<void> {
  try {
    const docRef = doc(db, "restaurants", restaurantId, "orders", orderId);
    await updateDoc(docRef, {
      status,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
}

/**
 * Update order
 */
export async function updateOrder(
  restaurantId: string,
  orderId: string,
  updates: Partial<Omit<Order, "order_id" | "customer_id" | "created_at">>
): Promise<void> {
  try {
    const docRef = doc(db, "restaurants", restaurantId, "orders", orderId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
}

// ─── Queries ───────────────────────────────────────────────────────────────────
export async function getQueries(restaurantId: string): Promise<CustomerQuery[]> {
  const q = query(collection(db, "restaurants", restaurantId, "queries"), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CustomerQuery);
}

export async function getCustomerQueries(
  restaurantId: string,
  customerId: string
): Promise<CustomerQuery[]> {
  const q = query(
    collection(db, "restaurants", restaurantId, "queries"),
    where("customer_id", "==", customerId),
    orderBy("created_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CustomerQuery);
}

export async function getManagerQueries(
  restaurantId: string,
  managerUid: string
): Promise<CustomerQuery[]> {
  const q = query(
    collection(db, "restaurants", restaurantId, "queries"),
    where("assigned_manager_uid", "==", managerUid),
    orderBy("created_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CustomerQuery);
}

export async function createQuery(
  restaurantId: string,
  data: Omit<CustomerQuery, "query_id" | "created_at" | "updated_at" | "remarks">
): Promise<string> {
  const colRef = collection(db, "restaurants", restaurantId, "queries");
  const docRef = doc(colRef);
  await addDoc(colRef, {
    ...data,
    query_id: docRef.id,
    remarks: [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateQueryStatus(
  restaurantId: string,
  queryId: string,
  status: QueryStatus,
  remark: QueryRemark
) {
  const queryRef = doc(db, "restaurants", restaurantId, "queries", queryId);
  const snap = await getDoc(queryRef);
  const existing: QueryRemark[] = snap.data()?.remarks ?? [];
  return updateDoc(queryRef, {
    status,
    remarks: [...existing, remark],
    updated_at: serverTimestamp(),
  });
}

export async function assignQueryToManager(
  restaurantId: string,
  queryId: string,
  managerUid: string,
  managerName: string
) {
  return updateDoc(doc(db, "restaurants", restaurantId, "queries", queryId), {
    assigned_manager_uid: managerUid,
    assigned_manager_name: managerName,
    status: "IN_PROGRESS",
    updated_at: serverTimestamp(),
  });
}

// ─── Analytics helpers ─────────────────────────────────────────────────────────
export async function getOrderCountByStatus(restaurantId: string) {
  const orders = await getOrders(restaurantId);
  return orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export async function getRevenueByDay(restaurantId: string, days = 7) {
  const orders = await getOrders(restaurantId);
  const result: Record<string, { revenue: number; orders: number }> = {};
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  orders.forEach((o) => {
    if (o.status === "CANCELLED") return;
    const ts = o.created_at?.toMillis?.() ?? 0;
    if (ts < cutoff) return;
    const day = new Date(ts).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    if (!result[day]) result[day] = { revenue: 0, orders: 0 };
    result[day].revenue += o.billing.grand_total;
    result[day].orders += 1;
  });
  return Object.entries(result).map(([date, v]) => ({ date, ...v }));
}