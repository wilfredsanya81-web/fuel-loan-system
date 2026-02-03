-- USERS
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    phone_number VARCHAR(20) UNIQUE,
    role VARCHAR(10) CHECK (role IN ('ADMIN','AGENT')),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RIDERS
CREATE TABLE riders (
    rider_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    phone_number VARCHAR(20) UNIQUE,
    national_id VARCHAR(30) UNIQUE,
    motorcycle_number VARCHAR(30),
    stage_location VARCHAR(100),
    status VARCHAR(15) CHECK (status IN ('ACTIVE','SUSPENDED','BLACKLISTED')) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LOANS
CREATE TABLE loans (
    loan_id SERIAL PRIMARY KEY,
    rider_id INT REFERENCES riders(rider_id),
    agent_id INT REFERENCES users(user_id),
    principal_amount DECIMAL(12,2),
    service_charge DECIMAL(12,2),
    outstanding_balance DECIMAL(12,2),
    total_penalty DECIMAL(12,2) DEFAULT 0,
    penalty_cap DECIMAL(12,2),
    issued_at TIMESTAMP,
    due_at TIMESTAMP,
    last_penalty_applied_at TIMESTAMP,
    status VARCHAR(15) CHECK (status IN ('ACTIVE','OVERDUE','PAID')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    loan_id INT REFERENCES loans(loan_id),
    amount_paid DECIMAL(12,2),
    payment_method VARCHAR(20),
    received_by INT REFERENCES users(user_id),
    payment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PENALTIES
CREATE TABLE penalties (
    penalty_id SERIAL PRIMARY KEY,
    loan_id INT REFERENCES loans(loan_id),
    penalty_amount DECIMAL(12,2),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mobile money callback audit (raw payloads)
CREATE TABLE payment_callbacks (
    callback_id SERIAL PRIMARY KEY,
    provider VARCHAR(20) CHECK (provider IN ('MTN','AIRTEL')),
    raw_payload JSONB,
    external_ref VARCHAR(100),
    amount DECIMAL(12,2),
    status VARCHAR(30),
    processed BOOLEAN DEFAULT FALSE,
    loan_id INT REFERENCES loans(loan_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loans_rider_status ON loans(rider_id, status);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payment_callbacks_external_ref ON payment_callbacks(external_ref);
CREATE INDEX idx_payment_callbacks_processed ON payment_callbacks(processed);
