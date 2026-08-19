/**
 * seed.ts — Run once to populate Firestore with demo data
 * Usage: npx ts-node --project tsconfig.json scripts/seed.ts
 *
 * Requires service account key. Add GOOGLE_APPLICATION_CREDENTIALS env var
 * pointing to your serviceAccountKey.json before running.
 *
 * Or use the Firebase console to manually create:
 *
 * 1. Create users via Firebase Auth console with emails:
 *    - root@demo.com        / demo1234  → role: root_admin
 *    - admin@demo.com       / demo1234  → role: restaurant_admin
 *    - manager@demo.com     / demo1234  → role: restaurant_manager
 *    - user@demo.com        / demo1234  → role: customer
 *
 * 2. Create /users/{uid} docs for each with matching role field
 *
 * 3. Create /restaurants/resto_001 with:
 *    {
 *      restaurant_id: "resto_001",
 *      business_name: "Cafe Oasis",
 *      url_slug: "cafeoasis",
 *      is_open: true,
 *      fssai_number: "12345678901234",
 *      gst_number: "22AAAAA0000A1Z5",
 *      upi_id: "cafeoasis@upi",
 *      cuisine_type: "Multi-cuisine",
 *      address: "42 MG Road, Bengaluru",
 *      phone: "+91 98765 43210",
 *      branding: { primary_color: "#ea580c", logo_url: "" },
 *      admin_uid: "<admin user uid>",
 *      manager_uids: ["<manager user uid>"]
 *    }
 *
 * 4. Update admin + manager users' associated_restaurants: ["resto_001"]
 *
 * 5. Add sample menu products to:
 *    /restaurants/resto_001/menu_products/
 *
 * Sample product:
 *    {
 *      product_id: "prod_001",
 *      restaurant_id: "resto_001",
 *      name: "Butter Chicken",
 *      category: "Mains",
 *      price: 320,
 *      is_available: true,
 *      is_veg: false,
 *      description: "Creamy tomato-based curry with tender chicken",
 *      discount_percent: 10,
 *      preparation_time: 20,
 *      image_url: ""
 *    }
 */

console.log("See comments in this file for manual seed instructions.");
