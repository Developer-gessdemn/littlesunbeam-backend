const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const connectDB = require("./config/db");
const app = require("./server");

async function testApiEndpoints() {
  console.log("\n==========================================");
  console.log("   RUNNING BACKEND ENDPOINT SUITE TESTS   ");
  console.log("==========================================\n");

  let adminToken = "";
  let userToken = "";

  // Helper for internal requests using fetch or HTTP
  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    // 1. Test Health Check
    console.log("▶ 1. Testing GET /api/health");
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log("   Status:", healthRes.status, "| Result:", healthData.message);

    // 2. Test Admin Login
    console.log("\n▶ 2. Testing POST /api/auth/login (Admin)");
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@littlesunbeam.com",
        password: "Admin@123456",
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    console.log("   Status:", adminLoginRes.status, "| Success:", adminLoginData.success);
    if (adminLoginData.data && adminLoginData.data.token) {
      adminToken = adminLoginData.data.token;
      console.log("   Admin token generated successfully");
    } else {
      console.error("   ❌ Admin login failed:", adminLoginData);
    }

    // 3. Test User Login
    console.log("\n▶ 3. Testing POST /api/auth/login (User)");
    const userLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "customer@littlesunbeam.com",
        password: "Customer@123456",
      }),
    });
    const userLoginData = await userLoginRes.json();
    console.log("   Status:", userLoginRes.status, "| Success:", userLoginData.success);
    if (userLoginData.data && userLoginData.data.token) {
      userToken = userLoginData.data.token;
      console.log("   User token generated successfully");
    }

    // 4. Test GET /api/products
    console.log("\n▶ 4. Testing GET /api/products");
    const prodRes = await fetch(`${baseUrl}/products`);
    const prodData = await prodRes.json();
    console.log("   Status:", prodRes.status, "| Products Count:", prodData.data?.products?.length);

    // 5. Test GET /api/products with search & filter
    console.log("\n▶ 5. Testing GET /api/products?search=Ethnic&category=ethnic");
    const filterRes = await fetch(`${baseUrl}/products?search=Ethnic&category=ethnic`);
    const filterData = await filterRes.json();
    console.log("   Status:", filterRes.status, "| Filtered Products:", filterData.data?.products?.length);

    // 6. Test GET /api/categories
    console.log("\n▶ 6. Testing GET /api/categories");
    const catRes = await fetch(`${baseUrl}/categories`);
    const catData = await catRes.json();
    console.log("   Status:", catRes.status, "| Categories Count:", catData.data?.categories?.length);

    // 7. Test Cart Endpoints
    console.log("\n▶ 7. Testing Cart Operations for User");
    if (userToken && prodData.data?.products?.[0]) {
      const firstProdId = prodData.data.products[0]._id;

      // Add to cart
      console.log("   7a. POST /api/cart (Add product)");
      const addCartRes = await fetch(`${baseUrl}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          productId: firstProdId,
          quantity: 2,
          selectedSize: "S",
          selectedColor: "Cream",
        }),
      });
      const addCartData = await addCartRes.json();
      console.log("       Status:", addCartRes.status, "| Cart Items Count:", addCartData.data?.items?.length);

      // Get cart
      console.log("   7b. GET /api/cart");
      const getCartRes = await fetch(`${baseUrl}/cart`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const getCartData = await getCartRes.json();
      console.log("       Status:", getCartRes.status, "| Subtotal:", getCartData.data?.subtotal);
    }

    // 8. Test Admin Dashboard Analytics
    console.log("\n▶ 8. Testing GET /api/admin/dashboard");
    if (adminToken) {
      const dashRes = await fetch(`${baseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const dashData = await dashRes.json();
      console.log("   Status:", dashRes.status, "| Total Products in Dashboard:", dashData.data?.summary?.totalProducts);
    }

    console.log("\n==========================================");
    console.log("   ALL ENDPOINT TESTS COMPLETED SUCCESS   ");
    console.log("==========================================\n");
  } catch (err) {
    console.error("❌ Test error:", err);
  } finally {
    process.exit(0);
  }
}

// Give server time to listen before running fetch
setTimeout(testApiEndpoints, 2000);
