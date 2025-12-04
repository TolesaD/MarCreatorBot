<?php
// Botomics Wallet API Gateway
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Parse request
$request_uri = $_SERVER['REQUEST_URI'];
$api_path = str_replace('/api/', '', $request_uri);
$api_path = explode('?', $api_path)[0];

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Get input data
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

// Get query parameters
$query = $_GET;

// Simple routing
switch ($api_path) {
    case 'health':
        handleHealth();
        break;
    
    case 'wallet/balance':
        handleWalletBalance($query);
        break;
    
    case 'wallet/transactions':
        handleWalletTransactions($query);
        break;
    
    case 'subscription/status':
        handleSubscriptionStatus($query);
        break;
    
    case 'upload/proof':
        handleUploadProof($input, $_FILES);
        break;
    
    case 'wallet/deposit':
        handleDeposit($input);
        break;
    
    case 'wallet/withdraw':
        handleWithdraw($input);
        break;
    
    case 'wallet/transfer':
        handleTransfer($input);
        break;
    
    case 'subscription/upgrade':
        handleSubscriptionUpgrade($input);
        break;
    
    case 'subscription/cancel':
        handleSubscriptionCancel($input);
        break;
    
    case 'subscription/auto-renew':
        handleAutoRenew($input);
        break;
    
    default:
        http_response_code(404);
        echo json_encode(['error' => 'API endpoint not found']);
        break;
}

// API Handlers
function handleHealth() {
    echo json_encode([
        'status' => 'online',
        'service' => 'Botomics Wallet API',
        'timestamp' => date('c'),
        'version' => '2.0.0',
        'environment' => getenv('NODE_ENV') ?: 'production'
    ]);
}

function handleWalletBalance($query) {
    $userId = $query['userId'] ?? 'unknown';
    
    // In production, fetch from database
    // For now, return mock data
    echo json_encode([
        'balance' => 15.50,
        'currency' => 'BOM',
        'isFrozen' => false,
        'freezeReason' => null,
        'userId' => $userId,
        'lastUpdated' => date('c')
    ]);
}

function handleWalletTransactions($query) {
    $userId = $query['userId'] ?? 'unknown';
    $page = intval($query['page'] ?? 1);
    $limit = intval($query['limit'] ?? 10);
    
    // Mock transactions
    $transactions = [
        [
            'id' => 'tx_001',
            'type' => 'deposit',
            'amount' => 50.00,
            'currency' => 'BOM',
            'description' => 'Initial deposit',
            'status' => 'completed',
            'created_at' => date('c', strtotime('-7 days'))
        ],
        [
            'id' => 'tx_002',
            'type' => 'subscription',
            'amount' => -5.00,
            'currency' => 'BOM',
            'description' => 'Premium subscription',
            'status' => 'completed',
            'created_at' => date('c', strtotime('-2 days'))
        ]
    ];
    
    echo json_encode([
        'transactions' => $transactions,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => 1,
            'totalItems' => count($transactions),
            'itemsPerPage' => $limit
        ]
    ]);
}

function handleSubscriptionStatus($query) {
    $userId = $query['userId'] ?? 'unknown';
    
    echo json_encode([
        'tier' => 'freemium',
        'autoRenew' => false,
        'nextBillingDate' => null,
        'startDate' => null,
        'userId' => $userId
    ]);
}

function handleUploadProof($input, $files) {
    // Validate authentication
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    // Handle file upload
    if (empty($files['proof'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No file uploaded']);
        return;
    }
    
    $file = $files['proof'];
    
    // Validate file
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!in_array($file['type'], $allowedTypes)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file type']);
        return;
    }
    
    if ($file['size'] > 5 * 1024 * 1024) { // 5MB
        http_response_code(400);
        echo json_encode(['error' => 'File too large']);
        return;
    }
    
    // Generate unique filename
    $filename = 'proof_' . uniqid() . '_' . $file['name'];
    $uploadPath = '../uploads/' . $filename;
    
    // Create uploads directory if not exists
    if (!file_exists('../uploads')) {
        mkdir('../uploads', 0755, true);
    }
    
    // Move uploaded file
    if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
        echo json_encode([
            'success' => true,
            'url' => '/uploads/' . $filename,
            'filename' => $filename
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to upload file']);
    }
}

function handleDeposit($input) {
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    // Validate input
    $required = ['userId', 'amount', 'proofImageUrl'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    // In production, save to database and notify admin
    echo json_encode([
        'success' => true,
        'message' => 'Deposit request submitted for verification',
        'transactionId' => 'dep_' . uniqid(),
        'amount' => floatval($input['amount']),
        'status' => 'pending',
        'timestamp' => date('c')
    ]);
}

function handleWithdraw($input) {
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $required = ['userId', 'amount', 'method', 'payoutDetails'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    // Validate amount
    $amount = floatval($input['amount']);
    if ($amount < 20) {
        http_response_code(400);
        echo json_encode(['error' => 'Minimum withdrawal is 20 BOM']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Withdrawal request submitted',
        'transactionId' => 'wdr_' . uniqid(),
        'amount' => $amount,
        'status' => 'pending',
        'processingTime' => '24 hours',
        'timestamp' => date('c')
    ]);
}

function handleTransfer($input) {
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $required = ['senderId', 'receiverId', 'amount'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    // Validate amount
    $amount = floatval($input['amount']);
    if ($amount <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid amount']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Transfer completed successfully',
        'transactionId' => 'trf_' . uniqid(),
        'amount' => $amount,
        'senderId' => $input['senderId'],
        'receiverId' => $input['receiverId'],
        'status' => 'completed',
        'timestamp' => date('c')
    ]);
}

function handleSubscriptionUpgrade($input) {
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $required = ['userId', 'plan', 'amount'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Subscription upgraded to Premium',
        'tier' => 'premium',
        'plan' => $input['plan'],
        'amount' => floatval($input['amount']),
        'autoRenew' => true,
        'nextBillingDate' => date('c', strtotime('+1 month')),
        'startDate' => date('c')
    ]);
}

function handleSubscriptionCancel($input) {
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Subscription cancelled',
        'tier' => 'freemium',
        'cancelledAt' => date('c'),
        'activeUntil' => date('c', strtotime('+30 days')) // Keep features for current period
    ]);
}

function handleAutoRenew($input) {
    if (!validateAuth()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'autoRenew' => $input['autoRenew'] ?? false,
        'message' => 'Auto-renewal updated'
    ]);
}

// Helper function to validate Telegram Web App authentication
function validateAuth() {
    // In production, validate Telegram Web App initData
    // For now, return true for testing
    return true;
    
    /*
    // Production validation example:
    $initData = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($initData)) {
        return false;
    }
    
    // Validate Telegram Web App initData
    // This requires implementing Telegram's validation logic
    return validateTelegramInitData($initData);
    */
}
?>