/**
 * API Route: POST /api/admin/assign-restaurant-admin
 *
 * ARCHITECTURE: Single-restaurant-per-user, restaurant-scoped roles
 *
 * Data Model:
 *   realtime-users/{email}:
 *     - managed_restaurant: string | null   (ONE restaurant only — source of truth for WHICH restaurant)
 *     - roles: string[]                     (cache of role(s) at that restaurant — see note below)
 *
 *   restaurants/{id}:
 *     - admin_uid: string | null
 *     - admin_email: string | null
 *     - manager_uids: string[]              (multiple managers allowed)
 *
 * Rules:
 *   1. A user can be admin AND manager of the SAME restaurant (dual role, same doc).
 *   2. A user can only be associated with ONE restaurant at a time.
 *   3. Assigning a user who is already tied to a DIFFERENT restaurant requires
 *      explicit confirmation (two-phase request via `confirmed` flag) — accepting
 *      revokes ALL their existing associations (admin + manager) with the old
 *      restaurant before granting the new one.
 *   4. Replacing an existing admin on the TARGET restaurant auto-downgrades that
 *      old admin — if they're also a manager there, they keep manager status and
 *      stay tied to the restaurant; otherwise they're fully released
 *      (managed_restaurant = null, roles = []).
 *
 * roles[] cache — why and how it stays correct:
 *   admin_uid / manager_uids on the restaurant doc remain the actual source of
 *   truth. roles[] on the user doc is a denormalized cache purely so a client
 *   can check "does this user have restaurant_admin OR restaurant_manager
 *   permissions" without a second read. To prevent the cache ever drifting
 *   (duplicates, stale entries, one role surviving a demotion, etc.), it is
 *   NEVER incrementally pushed/pulled — every write fully RECOMPUTES roles[]
 *   from the restaurant doc's admin_uid/manager_uids for that specific uid
 *   and overwrites the array wholesale. Same discipline applies to every
 *   OTHER user doc touched in this route (e.g. a downgraded former admin).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function initializeFirebaseAdmin() {
  const admin = await import("firebase-admin/app");
  const firestore = await import("firebase-admin/firestore");
  const authModule = await import("firebase-admin/auth");

  const getApps = admin.getApps;
  const initializeApp = admin.initializeApp;
  const cert = admin.cert;
  const getFirestore = firestore.getFirestore;
  const getAuth = authModule.getAuth;

  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase environment variables");
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });

    console.log("✅ Firebase Admin SDK initialized");
  }

  const db = getFirestore();
  const auth = getAuth();
  return { db, auth };
}

/**
 * Always derives the FULL roles[] array fresh from restaurant state for a
 * given uid — never mutated incrementally. Passing consistent inputs here
 * is what prevents abnormal/stale states (e.g. "restaurant_admin" surviving
 * after admin_uid changed to someone else).
 */
function computeRolesArray(
  restaurantLike: { admin_uid?: string | null; manager_uids?: string[] },
  uid: string
): string[] {
  const roles: string[] = [];
  if (restaurantLike.admin_uid === uid) roles.push("restaurant_admin");
  if ((restaurantLike.manager_uids || []).includes(uid)) roles.push("restaurant_manager");
  return roles;
}

export async function POST(request: NextRequest) {
  try {
    const { db, auth } = await initializeFirebaseAdmin();

    const body = await request.json();
    const {
      email,
      restaurantId,
      role = "restaurant_admin",
      confirmed = false, // ✅ set true on the second call, after the user confirms the revoke
    } = body;

    // ─── VALIDATION ───────────────────────────────────────────────────
    if (!email || !restaurantId) {
      return NextResponse.json(
        { success: false, message: "Email and restaurant ID are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!["restaurant_admin", "restaurant_manager"].includes(role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 400 }
      );
    }

    // ─── STEP 1: Verify target restaurant exists ───────────────────────
    const restaurantRef = db.collection("restaurants").doc(restaurantId);
    const restaurantDoc = await restaurantRef.get();

    if (!restaurantDoc.exists) {
      return NextResponse.json(
        { success: false, message: "Restaurant not found" },
        { status: 404 }
      );
    }

    const restaurantData = restaurantDoc.data() || {};
    console.log(`🏪 Target restaurant verified: ${restaurantId}`);

    // ─── STEP 2: Check/Create user in Firebase Auth ────────────────────
    let uid: string;
    let isNewUser = false;

    try {
      const userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
      console.log(`✅ Found existing auth user: ${email}`);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        console.log(`📝 Creating new auth user: ${email}`);
        const tempPassword = Math.random().toString(36).slice(-12);
        const userRecord = await auth.createUser({
          email,
          password: tempPassword,
          displayName: email.split("@")[0],
        });
        uid = userRecord.uid;
        isNewUser = true;
        console.log(`✨ New auth user created: ${email}`);
      } else {
        throw error;
      }
    }

    // ─── STEP 3: Check user's existing restaurant association ─────────
    const userRef = db.collection("realtime-users").doc(email);
    const userDoc = await userRef.get();
    const existingManagedRestaurant: string | null = userDoc.exists
      ? userDoc.data()?.managed_restaurant ?? null
      : null;

    const isCrossRestaurantMove =
      existingManagedRestaurant && existingManagedRestaurant !== restaurantId;

    // ─── STEP 3A: Require confirmation before crossing restaurants ────
    if (isCrossRestaurantMove && !confirmed) {
      const oldRestaurantRef = db.collection("restaurants").doc(existingManagedRestaurant!);
      const oldRestaurantDoc = await oldRestaurantRef.get();
      const oldRestaurantName = oldRestaurantDoc.exists
        ? oldRestaurantDoc.data()?.business_name || "their current restaurant"
        : "their current restaurant";

      return NextResponse.json(
        {
          success: false,
          needsConfirmation: true,
          message: `${email} is currently associated with "${oldRestaurantName}". Assigning them here will revoke ALL their roles (admin/manager) at "${oldRestaurantName}".`,
          conflictRestaurantId: existingManagedRestaurant,
          conflictRestaurantName: oldRestaurantName,
          targetRestaurantName: restaurantData.business_name,
        },
        { status: 409 } // Conflict — needs explicit confirmation
      );
    }

    // ─── STEP 3B: If confirmed cross-restaurant move, revoke old ties ──
    // Note: no roles[] write needed for the OLD restaurant here — this same
    // user's user doc gets its roles[] fully overwritten in STEP 5 based on
    // the NEW restaurant, which is the only state that matters going forward.
    if (isCrossRestaurantMove && confirmed) {
      const oldRestaurantRef = db.collection("restaurants").doc(existingManagedRestaurant!);
      const oldRestaurantDoc = await oldRestaurantRef.get();

      if (oldRestaurantDoc.exists) {
        const oldData = oldRestaurantDoc.data() || {};
        const updates: Record<string, any> = { updated_at: new Date() };

        // Clear admin fields if this user was the admin there
        if (oldData.admin_uid === uid) {
          updates.admin_uid = null;
          updates.admin_email = null;
        }

        // Remove from manager_uids if present
        const oldManagerUids: string[] = oldData.manager_uids || [];
        if (oldManagerUids.includes(uid)) {
          updates.manager_uids = oldManagerUids.filter((id) => id !== uid);
        }

        await oldRestaurantRef.update(updates);
        console.log(
          `🗑️ Revoked all associations for ${email} at ${existingManagedRestaurant}`
        );
      }
    }

    // ─── STEP 4: Assign role on TARGET restaurant ──────────────────────
    // We track the resulting admin_uid/manager_uids locally as we mutate,
    // so STEP 5 can compute the target user's roles[] from the true final
    // state without an extra read.
    let finalAdminUid: string | null = restaurantData.admin_uid ?? null;
    let finalManagerUids: string[] = restaurantData.manager_uids || [];

    if (role === "restaurant_admin") {
      const currentAdminUid = restaurantData.admin_uid;
      const currentAdminEmail = restaurantData.admin_email;

      // Downgrade the restaurant's CURRENT admin, if it's a different person
      if (currentAdminEmail && currentAdminEmail !== email && currentAdminUid) {
        const oldAdminRef = db.collection("realtime-users").doc(currentAdminEmail);
        const oldAdminDoc = await oldAdminRef.get();

        if (oldAdminDoc.exists) {
          const stillManagerHere = (restaurantData.manager_uids || []).includes(
            currentAdminUid
          );

          if (!stillManagerHere) {
            // Fully released — no roles left, no restaurant tie left
            await oldAdminRef.update({
              managed_restaurant: null,
              roles: [], // ✅ always [] here — nothing ties them to any restaurant anymore
              updated_at: new Date(),
            });
            console.log(`  ✅ Old admin (${currentAdminEmail}) fully released — roles cleared`);
          } else {
            // Still tied here, but only as manager now — recompute fresh
            // rather than trusting any previously-cached array.
            const oldAdminRolesAfterDowngrade = computeRolesArray(
              { admin_uid: uid /* new admin's uid — definitely not the old admin's */, manager_uids: finalManagerUids },
              currentAdminUid
            );
            await oldAdminRef.update({
              managed_restaurant: existingManagedRestaurant ?? restaurantId, // unchanged — still this restaurant
              roles: oldAdminRolesAfterDowngrade, // → ["restaurant_manager"]
              updated_at: new Date(),
            });
            console.log(
              `  ℹ️ Old admin (${currentAdminEmail}) downgraded to roles: [${oldAdminRolesAfterDowngrade.join(", ")}]`
            );
          }
        }
      }

      // Set new admin on restaurant
      await restaurantRef.update({
        admin_uid: uid,
        admin_email: email,
        updated_at: new Date(),
      });
      finalAdminUid = uid;
      console.log(`👑 ${email} set as admin of ${restaurantId}`);
    } else if (role === "restaurant_manager") {
      const managerUids: string[] = restaurantData.manager_uids || [];

      if (managerUids.includes(uid)) {
        return NextResponse.json(
          {
            success: false,
            message: `${email} is already a manager of ${restaurantData.business_name || 'this restaurant'}.`,
          },
          { status: 400 }
        );
      }

      const updatedManagerUids = [...managerUids, uid];
      await restaurantRef.update({
        manager_uids: updatedManagerUids,
        updated_at: new Date(),
      });
      finalManagerUids = updatedManagerUids;
      console.log(`👥 ${email} added to manager_uids of ${restaurantId}`);
    }

    // ─── STEP 5: Update / create the user doc ──────────────────────────
    // roles[] is fully recomputed from finalAdminUid/finalManagerUids —
    // this single write determines the target user's roles, and it must
    // reflect BOTH admin and manager status if they hold both (e.g. an
    // existing manager who is now also being made admin, or vice versa —
    // that dual-role case falls out naturally here with no special casing).
    const targetUserRoles = computeRolesArray(
      { admin_uid: finalAdminUid, manager_uids: finalManagerUids },
      uid
    );

    if (userDoc.exists) {
      await userRef.update({
        managed_restaurant: restaurantId, // ✅ single value, always in sync
        roles: targetUserRoles, // ✅ full overwrite — no incremental push/pull
        updated_at: new Date(),
      });
    } else {
      await userRef.set(
        {
          uid,
          email,
          name: email.split("@")[0],
          managed_restaurant: restaurantId,
          roles: targetUserRoles,
          orders: { past: [], live: [] },
          cart: [],
          address: "",
          paymentMethods: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }
    console.log(
      `✅ realtime-users/${email} → managed_restaurant = ${restaurantId}, roles = [${targetUserRoles.join(", ")}]`
    );

    // ─── STEP 6: Custom claims (best-effort) ───────────────────────────
    try {
      await auth.setCustomUserClaims(uid, { restaurantId, roles: targetUserRoles });
      console.log(`🔐 Custom claims set`);
    } catch (claimsError: any) {
      console.warn(`⚠️ Custom claims failed: ${claimsError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: isNewUser
          ? `New ${role === "restaurant_admin" ? "admin" : "manager"} account created. They can reset their password on login.`
          : `${role === "restaurant_admin" ? "Admin" : "Manager"} assigned successfully`,
        uid,
        isNewUser,
        role,
        roles: targetUserRoles,
        restaurantId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}