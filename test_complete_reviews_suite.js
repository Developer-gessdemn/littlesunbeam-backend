const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 5000;

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSuite() {
  console.log("=== Starting Complete Product Reviews & Ratings Verification ===");

  // 1. Get first active product
  const prodRes = await makeRequest({
    host: API_HOST,
    port: API_PORT,
    path: '/api/products?limit=1',
    method: 'GET',
  });

  if (prodRes.status !== 200 || !prodRes.data?.data?.products?.[0]) {
    console.error("Failed to fetch product for test:", prodRes);
    process.exit(1);
  }

  const testProduct = prodRes.data.data.products[0];
  const productId = testProduct._id || testProduct.id;
  console.log(`[PASS] Using Test Product: "${testProduct.name}" (ID: ${productId})`);

  // 2. Register/Login Rithi
  const rithiEmail = `rithi_${Date.now()}@example.com`;
  const rithiRegisterRes = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'Rithi',
      email: rithiEmail,
      password: 'password123',
      confirmPassword: 'password123',
    }
  );

  const rithiToken = rithiRegisterRes.data?.data?.token;
  if (!rithiToken) {
    console.error("Failed to register Rithi:", rithiRegisterRes);
    process.exit(1);
  }
  console.log("[PASS] User 1 (Rithi) authenticated successfully");

  // 3. Register/Login Sanjai
  const sanjaiEmail = `sanjai_${Date.now()}@example.com`;
  const sanjaiRegisterRes = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'Sanjai',
      email: sanjaiEmail,
      password: 'password123',
      confirmPassword: 'password123',
    }
  );

  const sanjaiToken = sanjaiRegisterRes.data?.data?.token;
  if (!sanjaiToken) {
    console.error("Failed to register Sanjai:", sanjaiRegisterRes);
    process.exit(1);
  }
  console.log("[PASS] User 2 (Sanjai) authenticated successfully");

  // 4. Rithi submits 5-star review
  const review1Res = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: `/api/products/${productId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rithiToken}`,
      },
    },
    {
      rating: 5,
      comment: 'Very soft and comfortable for my baby.',
    }
  );

  if (review1Res.status !== 201) {
    console.error("Failed to create Rithi's review:", review1Res);
    process.exit(1);
  }
  const rithiReviewId = review1Res.data?.data?.review?._id;
  console.log(`[PASS] Rithi submitted 5-star review. Review ID: ${rithiReviewId}`);
  console.log(`       Product stats: rating=${review1Res.data.data.productStats.rating}, reviewCount=${review1Res.data.data.productStats.reviewCount}`);

  // 5. Sanjai opens same product and fetches reviews
  const getReviewsRes = await makeRequest({
    host: API_HOST,
    port: API_PORT,
    path: `/api/products/${productId}/reviews`,
    method: 'GET',
  });

  if (getReviewsRes.status !== 200) {
    console.error("Failed to get product reviews:", getReviewsRes);
    process.exit(1);
  }
  const foundRithiReview = getReviewsRes.data?.data?.reviews?.find((r) => r._id === rithiReviewId);
  if (!foundRithiReview || foundRithiReview.user.name !== 'Rithi') {
    console.error("Rithi's review not found for Sanjai:", getReviewsRes.data);
    process.exit(1);
  }
  console.log(`[PASS] Sanjai fetched product reviews and sees Rithi's review from DB: "${foundRithiReview.comment}" by ${foundRithiReview.user.name}`);

  // 6. Sanjai votes helpful on Rithi's review
  const helpfulVoteRes = await makeRequest({
    host: API_HOST,
    port: API_PORT,
    path: `/api/reviews/${rithiReviewId}/helpful`,
    method: 'POST',
    headers: { Authorization: `Bearer ${sanjaiToken}` },
  });

  if (helpfulVoteRes.status !== 200 || !helpfulVoteRes.data?.data?.hasVoted) {
    console.error("Helpful vote failed:", helpfulVoteRes);
    process.exit(1);
  }
  console.log(`[PASS] Sanjai voted helpful on Rithi's review. Helpful count: ${helpfulVoteRes.data.data.helpfulCount}`);

  // 7. Sanjai submits a 4-star review
  const review2Res = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: `/api/products/${productId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanjaiToken}`,
      },
    },
    {
      rating: 4,
      comment: 'Good quality and fast delivery.',
    }
  );

  if (review2Res.status !== 201) {
    console.error("Failed to create Sanjai's review:", review2Res);
    process.exit(1);
  }
  console.log(`[PASS] Sanjai submitted 4-star review.`);
  console.log(`       Product stats: rating=${review2Res.data.data.productStats.rating}, reviewCount=${review2Res.data.data.productStats.reviewCount}`);

  // 8. Test Duplicate review rejection for Rithi
  const dupRes = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: `/api/products/${productId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rithiToken}`,
      },
    },
    {
      rating: 5,
      comment: 'Trying another review.',
    }
  );

  if (dupRes.status === 400) {
    console.log(`[PASS] Duplicate review properly blocked with message: "${dupRes.data.message}"`);
  } else {
    console.error("FAILED: Duplicate review was not blocked:", dupRes);
    process.exit(1);
  }

  // 9. Test Unauthorized Edit: Sanjai tries to edit Rithi's review
  const unauthorizedEditRes = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: `/api/reviews/${rithiReviewId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanjaiToken}`,
      },
    },
    { rating: 1, comment: 'Hacking Rithi review' }
  );

  if (unauthorizedEditRes.status === 403) {
    console.log(`[PASS] Security Check: Unauthorized review edit blocked (403 Forbidden).`);
  } else {
    console.error("FAILED: Security breach - unauthorized user was able to edit another user's review:", unauthorizedEditRes);
    process.exit(1);
  }

  // 10. Rithi updates her review
  const editRes = await makeRequest(
    {
      host: API_HOST,
      port: API_PORT,
      path: `/api/reviews/${rithiReviewId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rithiToken}`,
      },
    },
    { rating: 5, comment: 'Updated: Very soft, durable, washed multiple times!' }
  );

  if (editRes.status === 200 && editRes.data?.data?.review?.comment.includes('Updated')) {
    console.log(`[PASS] Rithi successfully updated her own review.`);
  } else {
    console.error("Failed to update review:", editRes);
    process.exit(1);
  }

  // 11. Test Global Home Page Reviews endpoint
  const globalReviewsRes = await makeRequest({
    host: API_HOST,
    port: API_PORT,
    path: '/api/reviews?limit=10',
    method: 'GET',
  });

  if (globalReviewsRes.status === 200 && Array.isArray(globalReviewsRes.data?.data?.reviews)) {
    console.log(`[PASS] Home Page Reviews endpoint returned ${globalReviewsRes.data.data.count} real customer reviews with populated product info.`);
  } else {
    console.error("Failed to fetch global reviews:", globalReviewsRes);
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log(" ALL PRODUCTION REVIEWS & RATINGS VERIFICATION TESTS PASSED!");
  console.log("=======================================================");
  process.exit(0);
}

runSuite().catch((err) => {
  console.error("Suite failed with error:", err);
  process.exit(1);
});
