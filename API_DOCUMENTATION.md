# Little Sunbeam Baby Clothing — REST API Documentation

This document outlines the complete REST API for the **Little Sunbeam Baby Clothing Ecommerce** backend.

**Base URL**: `http://localhost:5000/api`

---

## 1. Authentication Headers

Protected routes require a JWT token passed in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

---

## 2. Standard API Response Structure

### Success Response Format:
```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": { ... }
}
```

### Error Response Format:
```json
{
  "success": false,
  "message": "Specific error description"
}
```

---

## 3. Authentication APIs (`/api/auth`)

### 3.1 Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Access**: Public
- **Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password@123",
  "confirmPassword": "Password@123",
  "phone": "+91 98765 43210"
}
```
- **Response**: `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "6640c...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+91 98765 43210",
      "role": "user",
      "address": {}
    },
    "token": "eyJhbGciOi..."
  }
}
```

### 3.2 Login User
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Access**: Public
- **Request Body**:
```json
{
  "email": "john@example.com",
  "password": "Password@123"
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6640c...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOi..."
  }
}
```

### 3.3 Get Current Logged-in User Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Access**: Private (Protected)
- **Response**: `200 OK`

---

## 4. User Profile & Wishlist APIs (`/api/users`)

### 4.1 Get Profile
- **Method**: `GET`
- **Path**: `/api/users/profile`
- **Access**: Private

### 4.2 Update Profile
- **Method**: `PUT`
- **Path**: `/api/users/profile`
- **Access**: Private
- **Request Body**:
```json
{
  "name": "John Doe",
  "phone": "+91 98765 12345",
  "address": "742 Evergreen Terrace",
  "city": "Springfield",
  "state": "Oregon",
  "pincode": "97477"
}
```

### 4.3 Get Wishlist
- **Method**: `GET`
- **Path**: `/api/users/wishlist`
- **Access**: Private

### 4.4 Add Product to Wishlist
- **Method**: `POST`
- **Path**: `/api/users/wishlist/:productId`
- **Access**: Private

### 4.5 Remove Product from Wishlist
- **Method**: `DELETE`
- **Path**: `/api/users/wishlist/:productId`
- **Access**: Private

---

## 5. Product APIs (`/api/products`)

### 5.1 List & Search Products
- **Method**: `GET`
- **Path**: `/api/products`
- **Access**: Public
- **Query Parameters**:
  - `search`: Full text search on name, description, category, brand, SKU, tags
  - `category`: Category slug/name (e.g., `ethnic`, `muslin`, `hospital`)
  - `age`: Age group filter (e.g., `0 - 3 Months`, `6 - 12 Months`)
  - `print`: Print style (e.g., `flower`, `fruit`, `animal`, `cloud`)
  - `gender`: `Unisex`, `Boys`, `Girls`
  - `minPrice`: Number
  - `maxPrice`: Number
  - `sort`: `featured`, `low`, `high`, `rating`, `new`
  - `page`: Page number (default: 1)
  - `limit`: Number of items per page (default: 20)

### 5.2 Get Product Details
- **Method**: `GET`
- **Path**: `/api/products/:id` (Accepts MongoDB `_id`, `slug`, or `sku`)
- **Access**: Public

### 5.3 Create Product
- **Method**: `POST`
- **Path**: `/api/products`
- **Access**: Private / Admin
- **Request Body**:
```json
{
  "name": "Muslin Summer Romper",
  "description": "100% organic cotton gentle romper",
  "price": 599,
  "mrp": 799,
  "category": "clothing",
  "image": "https://...",
  "gallery": ["https://..."],
  "colors": [{ "name": "Cream", "hex": "#F5F2EB" }],
  "sizes": ["0-3M", "3-6M", "6-12M"],
  "stock": 50,
  "sku": "SUN-ROMP-599",
  "ageGroup": "0 - 3 Months",
  "gender": "Unisex"
}
```

### 5.4 Update Product
- **Method**: `PUT`
- **Path**: `/api/products/:id`
- **Access**: Private / Admin

### 5.5 Delete Product
- **Method**: `DELETE`
- **Path**: `/api/products/:id`
- **Access**: Private / Admin

---

## 6. Category APIs (`/api/categories`)

- `GET /api/categories` — Get active categories
- `GET /api/categories/:id` — Get single category by ID or slug
- `POST /api/categories` — Create category (Admin)
- `PUT /api/categories/:id` — Update category (Admin)
- `DELETE /api/categories/:id` — Delete category (Admin)

---

## 7. Shopping Cart APIs (`/api/cart`)

- `GET /api/cart` — Fetch user's cart items, subtotal, and count
- `POST /api/cart` — Add product to cart with size/color variants
  ```json
  {
    "productId": "6640c...",
    "quantity": 1,
    "selectedSize": "S",
    "selectedColor": "Cream"
  }
  ```
- `PUT /api/cart/:itemId` — Update item quantity (body: `{ "quantity": 2 }` or `{ "delta": 1 }`)
- `DELETE /api/cart/:itemId` — Remove single item from cart
- `DELETE /api/cart` — Clear entire cart

---

## 8. Order APIs (`/api/orders`)

### 8.1 Place Order
- **Method**: `POST`
- **Path**: `/api/orders`
- **Access**: Private
- **Request Body**:
```json
{
  "shippingAddress": {
    "name": "Alex Johnson",
    "email": "alex@example.com",
    "phone": "+91 98765 43210",
    "address": "742 Evergreen Terrace",
    "city": "Springfield",
    "state": "Tamil Nadu",
    "pincode": "641601"
  },
  "paymentMethod": "Online Payment",
  "couponCode": "SUNNY10",
  "notes": "Please leave with security if unavailable"
}
```
- **Response**: `201 Created` with generated order number (`ORD-XXXXX`).

### 8.2 Get User Order History
- **Method**: `GET`
- **Path**: `/api/orders`
- **Access**: Private

### 8.3 Get Order by ID
- **Method**: `GET`
- **Path**: `/api/orders/:id`
- **Access**: Private (User or Admin)

---

## 9. Admin Dashboard & Management APIs (`/api/admin`)

- `GET /api/admin/dashboard` — Complete analytics summary (total users, products, sales, status counts, low stock items, top sellers, 7-day sales trends)
- `GET /api/admin/orders` — All orders with filtering and pagination
- `GET /api/admin/orders/:id` — Order details
- `PUT /api/admin/orders/:id/status` — Update order status & payment status
- `GET /api/admin/users` — List all registered users

---

## 10. Image Upload APIs (`/api/upload`)

- `POST /api/upload/single` — Upload single image (form-data field `image`)
- `POST /api/upload/multiple` — Upload up to 10 images (form-data field `images`)
- Access: Private / Admin
- Returns accessible URL path: `/uploads/filename.webp`
