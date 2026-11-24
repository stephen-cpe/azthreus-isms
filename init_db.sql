-- ============================================================================
-- Azthreus ISMS - Integrated Student Management System
-- Azthreus Academy of Science and Technology
-- Consolidated database initialization script (schema + demo seed data)
--
-- Usage:
--   psql -U postgres -d azthreus_isms -f init_db.sql
--
-- This script drops and recreates everything, then re-seeds the database.
-- The demo timeline is anchored to the CURRENT date whenever it runs: the
-- "current" school year is the June-start Philippine school year that owns
-- today, with two prior years of returning-student history and one future
-- year (assessments/sections only, for enrollment demos). Re-run it any time
-- to refresh the demo.
--
-- Every student, parent, address, phone number, and previous school below is
-- invented. Names come from deterministic pools; the same seed produces the
-- same people on every run (the school-year dates and payment dates follow
-- the current date). Three prior-year payments are reversed as demo data, and
-- the matching audit rows are inserted directly.
--
-- Demo accounts (see README for details):
--   admin / ADMINpassword         (Administrator - full access)
--   registrar / REGISTRARpassword (Registrar - registration & inquiry)
--   cashier / CASHIERpassword     (Cashier - accounts & collections)
-- ============================================================================

-- The script is UTF-8. Tell the server that explicitly so names are stored
-- correctly even when psql runs on a Windows console whose code page is not
-- 1252/65001.
SET client_encoding = 'UTF8';

-- ============================================================================
-- SECTION 1: DROP EXISTING OBJECTS
-- ============================================================================
DROP VIEW IF EXISTS v_payment_history;
DROP VIEW IF EXISTS v_student_list;
DROP VIEW IF EXISTS v_balance_inquiry;
DROP TABLE IF EXISTS seed_enrollment;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS grade_periods CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS parents CASCADE;
DROP TABLE IF EXISTS school_history CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS levels CASCADE;
DROP TABLE IF EXISTS school_years CASCADE;
DROP TABLE IF EXISTS payment_modes CASCADE;
DROP TABLE IF EXISTS religions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS fee_types CASCADE;

-- Display-number sequences are independent objects (not owned by a table), so
-- they must be dropped explicitly before being recreated with their start
-- values. Code uses nextval() rather than MAX(...) + 1 so two concurrent
-- requests can never receive the same display number.
DROP SEQUENCE IF EXISTS students_reg_number_seq;
DROP SEQUENCE IF EXISTS accounts_account_id_seq;
DROP SEQUENCE IF EXISTS payments_payment_id_seq;

-- ============================================================================
-- SECTION 2: SCHEMA - LOOKUP TABLES
-- ============================================================================

-- School Years
CREATE TABLE school_years (
    id SERIAL PRIMARY KEY,
    year_code VARCHAR(20) UNIQUE NOT NULL,  -- e.g., '2026-2027'
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Academic Levels (modern Philippine K-12)
CREATE TABLE levels (
    id SERIAL PRIMARY KEY,
    level_name VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'Kindergarten', 'Grade 1'
    level_order INT,  -- 1 = Kindergarten, 13 = Grade 12
    level_category VARCHAR(20),  -- 'kindergarten', 'elementary', 'junior_high', 'senior_high'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sections
CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    section_name VARCHAR(50) NOT NULL,
    level_id INT REFERENCES levels(id),
    school_year_id INT REFERENCES school_years(id),
    adviser VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Modes
CREATE TABLE payment_modes (
    id SERIAL PRIMARY KEY,
    mode_name VARCHAR(50) UNIQUE NOT NULL,  -- 'Monthly', 'Quarterly', 'Semi-Annual', 'Cash/Annual'
    installments INT,  -- Number of payments (10, 4, 2, 1)
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Religions / Church Affiliations (optional on the parent record)
CREATE TABLE religions (
    id SERIAL PRIMARY KEY,
    religion_name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- scrypt: "scrypt$<salt>$<hash>"
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'registrar', 'cashier')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Fee Types
CREATE TABLE fee_types (
    id SERIAL PRIMARY KEY,
    fee_name VARCHAR(50) UNIQUE NOT NULL,  -- 'tuition', 'computer', 'registration', etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Display-number sequences (sequence-based IDs, never MAX(...) + 1)
CREATE SEQUENCE students_reg_number_seq START WITH 260001;
CREATE SEQUENCE accounts_account_id_seq START WITH 410001;
CREATE SEQUENCE payments_payment_id_seq START WITH 700001;

-- ============================================================================
-- SECTION 3: SCHEMA - MAIN TABLES
-- ============================================================================

-- Students (one row per person - current enrollment is never duplicated)
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    reg_number INT UNIQUE,  -- Registration number (displayed as AA-<number>)
    student_number VARCHAR(20),

    -- Personal Info
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(10),  -- 'Male', 'Female'
    birthdate DATE,
    birthplace VARCHAR(200),
    birth_order INT,
    age INT,

    -- Address
    address TEXT,
    barangay VARCHAR(100),

    -- Contact
    telephone VARCHAR(20),
    cellphone VARCHAR(20),

    -- Classification
    classification VARCHAR(20) DEFAULT 'New',  -- 'New', 'Old', 'Transferee', 'Returning'

    -- Academic Info (CURRENT enrollment - one row per person, never duplicated)
    current_level_id INT REFERENCES levels(id),
    current_section_id INT REFERENCES sections(id),
    school_year_id INT REFERENCES school_years(id),
    general_average DECIMAL(5,2),

    -- Enrollment Info
    date_enrolled DATE,
    status VARCHAR(20) DEFAULT 'enrolled',  -- 'enrolled', 'dropped', 'graduated', 'transferred'

    -- Photo
    photo_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parents Information
CREATE TABLE parents (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,

    -- Father Info
    father_name VARCHAR(200),
    father_occupation VARCHAR(100),
    father_age INT,
    father_education VARCHAR(100),

    -- Mother Info
    mother_name VARCHAR(200),
    mother_occupation VARCHAR(100),
    mother_age INT,
    mother_education VARCHAR(100),

    -- Contact
    telephone VARCHAR(20),
    local_ext VARCHAR(20),
    mobile_number VARCHAR(20),

    -- Religion (optional)
    religion_id INT REFERENCES religions(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School History (Previous Schools Attended)
CREATE TABLE school_history (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    school_level VARCHAR(50),  -- 'Kindergarten', 'Elementary', 'Junior High School', 'Senior High School'
    school_name VARCHAR(200),
    school_address TEXT,
    year_attended VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fee Assessments (Per Level/School Year)
CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    school_year_id INT REFERENCES school_years(id),
    level_id INT REFERENCES levels(id),

    -- Base Fees
    registration_fee DECIMAL(10,2) DEFAULT 0,
    tuition_fee DECIMAL(10,2) DEFAULT 0,
    miscellaneous_fee DECIMAL(10,2) DEFAULT 0,
    textbooks_fee DECIMAL(10,2) DEFAULT 0,
    computer_fee DECIMAL(10,2) DEFAULT 0,
    field_trip_fee DECIMAL(10,2) DEFAULT 0,
    school_uniform_fee DECIMAL(10,2) DEFAULT 0,
    pe_uniform_fee DECIMAL(10,2) DEFAULT 0,
    others_fee DECIMAL(10,2) DEFAULT 0,
    others_description TEXT,

    -- Total
    total_fee DECIMAL(10,2) DEFAULT 0,

    -- Upon Enrollment Amounts (by payment mode)
    upon_enrollment_semi_annual DECIMAL(10,2) DEFAULT 0,
    upon_enrollment_quarterly DECIMAL(10,2) DEFAULT 0,
    upon_enrollment_monthly DECIMAL(10,2) DEFAULT 0,

    -- Payable Amounts (by payment mode)
    payable_semi_annual DECIMAL(10,2) DEFAULT 0,
    payable_quarterly DECIMAL(10,2) DEFAULT 0,
    payable_monthly DECIMAL(10,2) DEFAULT 0,

    -- Adjustments
    adjustment_semi_annual DECIMAL(10,2) DEFAULT 0,
    adjustment_quarterly DECIMAL(10,2) DEFAULT 0,
    adjustment_monthly DECIMAL(10,2) DEFAULT 0,

    extra_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(school_year_id, level_id)
);

-- Student Accounts (one per student per school year - the enrollment history)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_id INT UNIQUE,  -- Display ID (displayed as AC-<number>)
    account_number INT,  -- Same as reg_number
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    school_year_id INT REFERENCES school_years(id),
    level_id INT REFERENCES levels(id),
    payment_mode_id INT REFERENCES payment_modes(id),

    -- Fees
    total_school_fees DECIMAL(10,2) DEFAULT 0,
    tuition_fee DECIMAL(10,2) DEFAULT 0,
    monthly_tuition DECIMAL(10,2) DEFAULT 0,

    -- Payments
    initial_payment DECIMAL(10,2) DEFAULT 0,  -- Upon enrollment
    discount DECIMAL(10,2) DEFAULT 0,
    total_payments_made DECIMAL(10,2) DEFAULT 0,
    total_balance DECIMAL(10,2) DEFAULT 0,
    books_purchased DECIMAL(10,2) DEFAULT 0,

    -- Statement of Account
    months_not_paid INT DEFAULT 0,
    balance_upon_enrollment DECIMAL(10,2) DEFAULT 0,
    unpaid_accounts DECIMAL(10,2) DEFAULT 0,
    current_dues DECIMAL(10,2) DEFAULT 0,
    due_date DATE,

    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_by VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Records
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    payment_id INT UNIQUE,  -- Display ID (displayed as AZR-<number>)
    account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
    student_id INT REFERENCES students(id),
    payer_name VARCHAR(200),  -- For payments not tied to a student account

    -- Payment Info
    payment_date DATE NOT NULL,
    receipt_number VARCHAR(50),
    payment_month VARCHAR(20),  -- 'January', 'February', etc.
    description VARCHAR(200),

    -- Fee Breakdown
    tuition_amount DECIMAL(10,2) DEFAULT 0,
    computer_amount DECIMAL(10,2) DEFAULT 0,
    registration_amount DECIMAL(10,2) DEFAULT 0,
    miscellaneous_amount DECIMAL(10,2) DEFAULT 0,
    books_amount DECIMAL(10,2) DEFAULT 0,
    others_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,

    -- Payment Method
    form_of_payment VARCHAR(20) DEFAULT 'Cash',  -- 'Cash', 'Check'
    check_date DATE,
    check_number VARCHAR(50),
    bank_name VARCHAR(100),
    branch VARCHAR(100),

    -- Transaction Info
    amount_tendered DECIMAL(10,2) DEFAULT 0,
    change_amount DECIMAL(10,2) DEFAULT 0,

    -- Reversal: posted payments are never edited or deleted. A correction is a
    -- new row with entry_type = 'reversal' whose amounts are negated.
    entry_type VARCHAR(10) NOT NULL DEFAULT 'payment'
        CHECK (entry_type IN ('payment', 'reversal')),
    reverses_payment_id INT REFERENCES payments(id),
    reason TEXT,
    CONSTRAINT payments_reversal_shape_check CHECK (
        (entry_type = 'payment' AND reverses_payment_id IS NULL)
        OR (
            entry_type = 'reversal'
            AND reverses_payment_id IS NOT NULL
            AND reason IS NOT NULL
            AND CHAR_LENGTH(BTRIM(reason)) BETWEEN 10 AND 300
        )
    ),

    -- Metadata
    posted_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log (written in the same transaction as the change it describes)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id INT REFERENCES users(id),
    username VARCHAR(50),
    action VARCHAR(40) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id VARCHAR(40),
    summary TEXT NOT NULL,
    details JSONB
);

-- Subjects (per curriculum category)
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    level_category VARCHAR(20),  -- 'kindergarten', 'elementary', 'junior_high', 'senior_high'
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject_name, level_category)
);

-- Grading Periods (per school year)
CREATE TABLE grade_periods (
    id SERIAL PRIMARY KEY,
    school_year_id INT REFERENCES school_years(id),
    period_name VARCHAR(30) NOT NULL,  -- '1st Quarter', '2nd Quarter', ...
    period_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_year_id, period_name)
);

-- Grades (one row per student/subject/period)
CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id),
    grade_period_id INT REFERENCES grade_periods(id),
    school_year_id INT REFERENCES school_years(id),
    numeric_grade DECIMAL(5,2),  -- Philippine grading scale (75 = passing)
    remarks VARCHAR(50),  -- 'Passed', 'Failed', 'Incomplete'
    posted_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id, grade_period_id)
);

-- ============================================================================
-- SECTION 4: INDEXES
-- ============================================================================
CREATE INDEX idx_students_last_name ON students(last_name);
CREATE INDEX idx_students_reg_number ON students(reg_number);
CREATE INDEX idx_students_school_year ON students(school_year_id);
CREATE INDEX idx_students_level ON students(current_level_id);
CREATE INDEX idx_students_section ON students(current_section_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_accounts_student ON accounts(student_id);
CREATE INDEX idx_accounts_school_year ON accounts(school_year_id);
-- One account per student per school year. The app checks this before
-- inserting; the unique index also closes the concurrent-insert race.
CREATE UNIQUE INDEX idx_accounts_student_year_unique ON accounts(student_id, school_year_id);
CREATE INDEX idx_payments_account ON payments(account_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_receipt ON payments(receipt_number);
-- A payment may be reversed at most once.
CREATE UNIQUE INDEX idx_payments_reverses_unique ON payments(reverses_payment_id)
    WHERE reverses_payment_id IS NOT NULL;
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_grades_subject ON grades(subject_id);
CREATE INDEX idx_grades_period ON grades(grade_period_id);
CREATE INDEX idx_grades_school_year ON grades(school_year_id);
CREATE INDEX idx_grade_periods_year ON grade_periods(school_year_id);
CREATE INDEX idx_subjects_category ON subjects(level_category);

-- ============================================================================
-- SECTION 5: SEED - LOOKUP DATA
-- ============================================================================

-- School Years: anchored to the current date. The June-start school year that
-- owns today is marked current (April/May count as enrollment season for the
-- upcoming year). Two prior years hold returning-student history, one future
-- year holds assessments/sections for enrollment demos.
INSERT INTO school_years (year_code, start_date, end_date, is_current)
SELECT
    (base.y + o.offs)::text || '-' || (base.y + o.offs + 1)::text,
    MAKE_DATE(base.y + o.offs, 6, 1),
    MAKE_DATE(base.y + o.offs + 1, 3, 31),
    o.offs = 0
FROM (
    SELECT CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
        ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - 1 END AS y
) base
CROSS JOIN (VALUES (-3), (-2), (-1), (0), (1)) AS o(offs);

-- Academic Levels (modern Philippine K-12). Senior High is a single STEM
-- strand; the strand is part of the displayed level label.
INSERT INTO levels (level_name, level_order, level_category) VALUES
('Kindergarten',       1,  'kindergarten'),
('Grade 1',            2,  'elementary'),
('Grade 2',            3,  'elementary'),
('Grade 3',            4,  'elementary'),
('Grade 4',            5,  'elementary'),
('Grade 5',            6,  'elementary'),
('Grade 6',            7,  'elementary'),
('Grade 7',            8,  'junior_high'),
('Grade 8',            9,  'junior_high'),
('Grade 9',            10, 'junior_high'),
('Grade 10',           11, 'junior_high'),
('Grade 11 (STEM)',    12, 'senior_high'),
('Grade 12 (STEM)',    13, 'senior_high');

-- Payment Modes
INSERT INTO payment_modes (mode_name, installments, description) VALUES
('Monthly', 10, 'Payment spread over 10 months from June to March'),
('Quarterly', 4, 'Payment in 4 quarterly installments'),
('Semi-Annual', 2, 'Payment in 2 semi-annual installments'),
('Cash/Annual', 1, 'Full payment upon enrollment');

-- Religions (optional on the parent record)
INSERT INTO religions (religion_name) VALUES
('Roman Catholic'),
('Baptist'),
('Born Again Christian'),
('Methodist'),
('Iglesia ni Cristo'),
('Seventh Day Adventist'),
('Church of Christ'),
('Islam'),
('Buddhist'),
('Others');

-- Fee Types
INSERT INTO fee_types (fee_name, description) VALUES
('tuition', 'Tuition Fee'),
('computer', 'Computer Fee'),
('registration', 'Registration Fee'),
('miscellaneous', 'Miscellaneous Fee'),
('textbooks', 'Textbooks'),
('field_trip', 'Field Trip Fee'),
('school_uniform', 'School Uniform'),
('pe_uniform', 'PE Uniform'),
('others', 'Other Fees');

-- System Users (passwords hashed with scrypt - see README for plaintext demo passwords)
INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES
('admin', 'scrypt$f6db191d86ce9dd77f3fe763376ecfdb$f6af23a6d228001ce6a65dacac028270a9b61609e8f1e0547cfdbcaabe8b01c367b43d442a83eab4ff356a2f9182babe004204fca85349a646b1df529d6d864d', 'System Administrator', 'admin', TRUE),
('registrar', 'scrypt$c7105977e98061925dfdc20661a558b8$d9f02b7dd352aa6adcd18efdf09bdb4e607d19b245d41cf9ec228fe055fcffc35d126074c55e1957c64aff252552b3c5ea86b1229708ca694386eb954b15c9b3', 'Maria Reyes', 'registrar', TRUE),
('cashier', 'scrypt$451659c449f536323e5d7d0051b98d41$4adfccb504497489def769878b67afdcc13a33a36f97583c25ee6273e854c56a3cf22b272a02613f4c408890c905076837805d1a22aaf5482155bb84987f9d06', 'John Dela Cruz', 'cashier', TRUE);

-- Sections (one per level per school year, named after a fixed star)
INSERT INTO sections (section_name, level_id, school_year_id, adviser)
SELECT
    l.level_name || ' - ' || (ARRAY[
        'Lyra',       -- Kindergarten
        'Altair',     -- Grade 1
        'Rigel',      -- Grade 2
        'Deneb',      -- Grade 3
        'Polaris',    -- Grade 4
        'Sirius',     -- Grade 5
        'Capella',    -- Grade 6
        'Vega',       -- Grade 7
        'Antares',    -- Grade 8
        'Arcturus',   -- Grade 9
        'Spica',      -- Grade 10
        'Orion',      -- Grade 11 (STEM)
        'Cassiopeia'  -- Grade 12 (STEM)
    ])[l.level_order],
    l.id,
    sy.id,
    (ARRAY[
        'Ms. Carmela Santos',
        'Mrs. Josephine Reyes',
        'Ms. Anne Marie Cruz',
        'Mrs. Lourdes Garcia',
        'Mrs. Elena Lopez',
        'Mr. Ramon Martinez',
        'Ms. Teresa Gonzales',
        'Mrs. Rosario Rivera',
        'Mr. Antonio Torres',
        'Ms. Marilou Ramos',
        'Mrs. Cecilia Flores',
        'Mr. Ernesto Villanueva',
        'Ms. Isabel Castillo'
    ])[l.level_order]
FROM levels l
CROSS JOIN school_years sy;

-- Subjects per curriculum category. This is an illustrative demo list, not a
-- certified DepEd curriculum.
INSERT INTO subjects (subject_name, level_category, sort_order) VALUES
('Language and Literacy', 'kindergarten', 1),
('Numeracy', 'kindergarten', 2),
('Understanding the Environment', 'kindergarten', 3),
('Motor and Creative Development', 'kindergarten', 4),
('Social and Emotional Learning', 'kindergarten', 5),

('Filipino', 'elementary', 1),
('English', 'elementary', 2),
('Mathematics', 'elementary', 3),
('Science', 'elementary', 4),
('Araling Panlipunan', 'elementary', 5),
('MAPEH', 'elementary', 6),
('GMRC', 'elementary', 7),
('Edukasyong Pantahanan at Pangkabuhayan', 'elementary', 8),

('Filipino', 'junior_high', 1),
('English', 'junior_high', 2),
('Mathematics', 'junior_high', 3),
('Science', 'junior_high', 4),
('Araling Panlipunan', 'junior_high', 5),
('MAPEH', 'junior_high', 6),
('Values Education', 'junior_high', 7),
('Technology and Livelihood Education', 'junior_high', 8),

('Oral Communication', 'senior_high', 1),
('Komunikasyon at Pananaliksik', 'senior_high', 2),
('General Mathematics', 'senior_high', 3),
('Pre-Calculus', 'senior_high', 4),
('Basic Calculus', 'senior_high', 5),
('General Biology', 'senior_high', 6),
('General Chemistry', 'senior_high', 7),
('General Physics', 'senior_high', 8);

-- Grading Periods: four quarters per school year for every level. Senior High
-- semesters are out of scope for this demo and are represented as quarters.
INSERT INTO grade_periods (school_year_id, period_name, period_order)
SELECT sy.id, p.period_name, p.period_order
FROM school_years sy
CROSS JOIN (VALUES
    ('1st Quarter', 1),
    ('2nd Quarter', 2),
    ('3rd Quarter', 3),
    ('4th Quarter', 4)
) AS p(period_name, period_order);

-- ============================================================================
-- SECTION 6: SEED - ASSESSMENTS (fee structures)
-- ============================================================================
-- Installment rules (also used by the application when enrolling):
--   Monthly:     20% upon enrollment, 10 x 8%
--   Quarterly:   30% upon enrollment, 4 x 17.5%
--   Semi-Annual: 50% upon enrollment, 2 x 25%
--   Cash/Annual: 100% upon enrollment
-- Fees escalate ~5% per year from the base schedule below (two years before
-- the current school year). The base table is round and rises by band:
-- Kindergarten is the lowest, Senior High is the highest. Total is the sum of
-- registration + tuition + miscellaneous + computer + textbooks.
INSERT INTO assessments (
    school_year_id, level_id, registration_fee, tuition_fee, miscellaneous_fee,
    computer_fee, textbooks_fee, total_fee,
    upon_enrollment_monthly, payable_monthly,
    upon_enrollment_quarterly, payable_quarterly,
    upon_enrollment_semi_annual, payable_semi_annual
)
SELECT
    sy.id, l.id,
    ROUND(v.reg * m.mult, 2), ROUND(v.tuition * m.mult, 2),
    ROUND(v.misc * m.mult, 2), ROUND(v.computer * m.mult, 2),
    ROUND(v.textbooks * m.mult, 2),
    ROUND(v.total * m.mult, 2),
    ROUND(v.total * m.mult * 0.20, 2), ROUND(v.total * m.mult * 0.08, 2),
    ROUND(v.total * m.mult * 0.30, 2), ROUND(v.total * m.mult * 0.175, 2),
    ROUND(v.total * m.mult * 0.50, 2), ROUND(v.total * m.mult * 0.25, 2)
FROM (VALUES
    ('Kindergarten',     1000.00, 16000.00, 2000.00,    0.00,  500.00, 19500.00),
    ('Grade 1',          1000.00, 17000.00, 2000.00, 1000.00,  500.00, 21500.00),
    ('Grade 2',          1000.00, 17000.00, 2000.00, 1000.00,  500.00, 21500.00),
    ('Grade 3',          1000.00, 17600.00, 2000.00, 1000.00,  500.00, 22100.00),
    ('Grade 4',          1000.00, 17600.00, 2000.00, 1000.00,  500.00, 22100.00),
    ('Grade 5',          1000.00, 18000.00, 2000.00, 1000.00,  500.00, 22500.00),
    ('Grade 6',          1000.00, 18000.00, 2000.00, 1000.00,  500.00, 22500.00),
    ('Grade 7',          1200.00, 19600.00, 2600.00, 1600.00,  800.00, 25800.00),
    ('Grade 8',          1200.00, 19600.00, 2600.00, 1600.00,  800.00, 25800.00),
    ('Grade 9',          1200.00, 19800.00, 2600.00, 1600.00,  800.00, 26000.00),
    ('Grade 10',         1200.00, 19800.00, 2600.00, 1600.00,  800.00, 26000.00),
    ('Grade 11 (STEM)',  1500.00, 22500.00, 3200.00, 2200.00, 1100.00, 30500.00),
    ('Grade 12 (STEM)',  1500.00, 23000.00, 3200.00, 2200.00, 1100.00, 31000.00)
) AS v(level_name, reg, tuition, misc, computer, textbooks, total)
JOIN levels l ON l.level_name = v.level_name
CROSS JOIN school_years sy
CROSS JOIN LATERAL (
    SELECT POWER(1.05, (
        EXTRACT(YEAR FROM sy.start_date)::int
        - EXTRACT(YEAR FROM (SELECT start_date FROM school_years WHERE is_current))::int
        + 2
    )::numeric) AS mult
) m
WHERE (EXTRACT(YEAR FROM sy.start_date)::int
       - EXTRACT(YEAR FROM (SELECT start_date FROM school_years WHERE is_current))::int)
      BETWEEN -3 AND 1;

-- ============================================================================
-- SECTION 7: SEED - STUDENTS (one row per person - never duplicated)
-- ============================================================================
-- Every student is generated from the name pools below; there are no
-- hand-authored people. The pool walk is deterministic: within a gender,
-- first names cycle every 40 rows and surnames every 41 rows, so a
-- (first name, surname) pair repeats only after 1,640 students. The seed has
-- about 133 students per gender, so full names are unique.
--
-- Distribution: 20 students in every level, plus 3 extra Grade 6 and 3 extra
-- Grade 12 rows. The extras become the prior-year graduates: after graduation
-- each of those levels still has 20 enrolled students. Two students are
-- dropped mid-year and one transferred out; every level keeps at least 19
-- enrolled students.
INSERT INTO students (
    student_number, first_name, middle_name, last_name,
    gender, birthdate, birthplace, birth_order, age, address, barangay, cellphone,
    current_level_id, school_year_id, date_enrolled, classification
)
WITH level_counts(level_order, student_count) AS (
    VALUES
        (1, 20), (2, 20), (3, 20), (4, 20), (5, 20), (6, 20),
        (7, 23),
        (8, 20), (9, 20), (10, 20), (11, 20), (12, 20),
        (13, 23)
),
base AS (
    SELECT lc.level_order, gs AS level_seq
    FROM level_counts lc
    CROSS JOIN LATERAL generate_series(1, lc.student_count) AS gs
),
numbered AS (
    SELECT
        b.level_order,
        b.level_seq,
        ROW_NUMBER() OVER (ORDER BY b.level_order, b.level_seq) AS seq,
        CASE
            WHEN ROW_NUMBER() OVER (ORDER BY b.level_order, b.level_seq) % 2 = 0 THEN 'Female'
            ELSE 'Male'
        END AS gender
    FROM base b
),
named AS (
    SELECT
        n.*,
        ROW_NUMBER() OVER (PARTITION BY n.gender ORDER BY n.seq) AS name_seq
    FROM numbered n
),
pools AS (
    SELECT
        ARRAY[
            'Aaron','Adrian','Aldrin','Alejandro','Alfonso','Alfredo','Andres','Angelo','Antonio','Arnel',
            'Arthur','Benjamin','Bernard','Bryan','Carlo','Cedric','Christian','Christopher','Daniel','Dario',
            'Dennis','Dominic','Eduardo','Elijah','Emmanuel','Enrique','Eric','Ernesto','Ferdinand','Francis',
            'Gabriel','Gerald','Harold','Henry','Ian','Ivan','Jacob','Jaime','Joaquin','Jose'
        ] AS male_first,
        ARRAY[
            'Abigail','Adriana','Aileen','Alexandra','Alice','Alicia','Althea','Alyssa','Amanda','Amelia',
            'Andrea','Angela','Angelica','Anna','Antonia','Ariana','Beatrice','Bella','Bernadette','Bianca',
            'Camille','Carla','Carmela','Carmen','Cassandra','Catherine','Cecilia','Celeste','Charmaine','Christina',
            'Claire','Clarisse','Claudia','Corazon','Cristina','Cynthia','Daisy','Diana','Elena','Eliza'
        ] AS female_first,
        ARRAY[
            'Santos','Reyes','Cruz','Bautista','Villanueva','Gonzales','Aquino','Navarro','Salazar','Domingo',
            'Garcia','Mendoza','Torres','Flores','Rivera','Ramos','Mercado','Castillo','Dela Cruz','Rosales',
            'Padilla','Pascual','Perez','Ramirez','Robles','Rojas','Sarmiento','Serrano','Sison','Soriano',
            'Tolentino','Valdez','Abad','Abella','Acosta','Alcantara','Alonzo','Alvarez','Andrade','Angeles',
            'Arellano'
        ] AS surnames,
        ARRAY[
            'Santos','Reyes','Cruz','Lopez','Martinez','Gonzales','Rivera','Torres','Ramos','Flores',
            'Villanueva','Castillo','Navarro','Salazar','Mercado','Padilla','Pascual','Perez','Pineda','Ramirez',
            'Robles','Rojas','Rosales','Roxas','Sarmiento','Serrano','Sison','Soriano','Tolentino','Valdez'
        ] AS middle_names,
        ARRAY[
            'Zone 1','Zone 1-A','Zone 2','Zone 3','Zone 4','Zone 4-A','Zone 5','Zone 6','Zone 7',
            'Canjusa','Crossing Pulupandan','Culo','Mabini','Pag-ayon','Palaka Norte','Palaka Sur',
            'Patic','Tapong','Ubay','Utod'
        ] AS barangays,
        ARRAY['Bago City','Valladolid','San Enrique','Pontevedra','La Carlota City'] AS towns,
        ARRAY['Pulupandan','Bago City','Valladolid','San Enrique','Pontevedra','La Carlota City'] AS birthplaces
)
SELECT
    LEFT(sy.year_code, 4) || '-' || LPAD(n.seq::text, 4, '0'),
    CASE
        WHEN n.gender = 'Male' THEN p.male_first[1 + (((n.name_seq - 1) % 40)::int)]
        ELSE p.female_first[1 + (((n.name_seq - 1) % 40)::int)]
    END,
    p.middle_names[1 + ((((n.name_seq - 1) * 11) % 30)::int)],
    p.surnames[1 + ((((n.name_seq - 1) * 7) % 41)::int)],
    n.gender,
    (CURRENT_DATE - MAKE_INTERVAL(
        years => (l.level_order + 4 + (n.seq % 2))::int,
        days => (n.seq % 300)::int
    ))::date,
    p.birthplaces[1 + ((n.seq % 6)::int)],
    (1 + (n.seq % 3))::int,
    (l.level_order + 4 + (n.seq % 2))::int,
    CASE
        WHEN n.seq % 4 = 0
            THEN 'Purok ' || (1 + (n.seq % 7))::text || ', ' || p.towns[1 + ((n.seq % 5)::int)]
        ELSE 'Purok ' || (1 + (n.seq % 7))::text || ', Barangay ' ||
             p.barangays[1 + ((n.seq % 20)::int)] || ', Pulupandan'
    END,
    CASE
        WHEN n.seq % 4 = 0 THEN p.towns[1 + ((n.seq % 5)::int)]
        ELSE p.barangays[1 + ((n.seq % 20)::int)]
    END,
    '0900-555-' || LPAD((1000 + (n.seq * 37) % 9000)::text, 4, '0'),
    l.id,
    sy.id,
    sy.start_date - ((n.seq % 45)::int),
    CASE
        WHEN n.seq = 144 THEN 'Transferee'
        WHEN n.seq % 9 = 0 THEN 'New'
        ELSE 'Old'
    END
FROM named n
JOIN levels l ON l.level_order = n.level_order
CROSS JOIN (SELECT id, year_code, start_date FROM school_years WHERE is_current) sy
CROSS JOIN pools p
ORDER BY n.level_order, n.level_seq;

-- Assign registration numbers from the sequence in deterministic roster order
-- (student_number encodes the roster position). Doing this after insert makes
-- the mapping of AA-number to person stable regardless of the insert plan.
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM students ORDER BY student_number LOOP
        UPDATE students
        SET reg_number = nextval('students_reg_number_seq')
        WHERE id = rec.id;
    END LOOP;
END $$;

-- Three Grade 6 graduates from the prior school year are the re-enrollment
-- demo subjects (they return into Grade 7). They finished the prior year, so
-- their current enrollment record points at that year and status is graduated.
UPDATE students s
SET current_section_id = NULL,
    school_year_id = (
        SELECT id FROM school_years
        WHERE start_date < (SELECT start_date FROM school_years WHERE is_current)
        ORDER BY start_date DESC LIMIT 1
    ),
    status = 'graduated',
    classification = 'Old',
    date_enrolled = (
        SELECT start_date - 25 FROM school_years
        WHERE start_date < (SELECT start_date FROM school_years WHERE is_current)
        ORDER BY start_date DESC LIMIT 1
    )
WHERE s.reg_number IN (260121, 260122, 260123);

-- Three Grade 12 graduates from the prior school year (they finished schooling).
UPDATE students s
SET current_section_id = NULL,
    school_year_id = (
        SELECT id FROM school_years
        WHERE start_date < (SELECT start_date FROM school_years WHERE is_current)
        ORDER BY start_date DESC LIMIT 1
    ),
    status = 'graduated',
    classification = 'Old',
    date_enrolled = (
        SELECT start_date - 25 FROM school_years
        WHERE start_date < (SELECT start_date FROM school_years WHERE is_current)
        ORDER BY start_date DESC LIMIT 1
    )
WHERE s.reg_number IN (260244, 260245, 260246);

-- Align age and birthdate with the final level (Kindergarten ~5-6, Grade 6
-- ~11-12, Grade 12 ~17-18). This runs after the graduation updates so
-- graduates keep ages that match the level they finished.
UPDATE students s SET
    age = l.level_order + 4 + (s.id % 2),
    birthdate = (CURRENT_DATE - MAKE_INTERVAL(
        years => l.level_order + 4 + (s.id % 2),
        days => s.id % 300
    ))::date,
    birth_order = COALESCE(s.birth_order, 1 + (s.id % 3))
FROM levels l
WHERE l.id = s.current_level_id;

-- Two students dropped mid-year and one transferred out (lifecycle demo
-- subjects). All live in levels with surplus students, so every level keeps at
-- least 18 records.
UPDATE students SET status = 'dropped' WHERE reg_number IN (260061, 260164);
UPDATE students SET status = 'transferred' WHERE reg_number = 260144;

-- Assign sections to every student, matching level + enrollment year.
UPDATE students s SET current_section_id = sec.id
FROM sections sec
WHERE sec.level_id = s.current_level_id
  AND sec.school_year_id = s.school_year_id
  AND s.current_section_id IS NULL;

-- ============================================================================
-- SECTION 8: SEED - PARENTS AND SCHOOL HISTORY
-- ============================================================================

-- Parent records for every student, with invented names, generic occupations,
-- and ages relative to the child. Religion is optional: only about 30% of the
-- parent rows carry one.
INSERT INTO parents (
    student_id, father_name, mother_name, father_occupation, mother_occupation,
    father_age, mother_age, father_education, mother_education,
    telephone, mobile_number, religion_id
)
SELECT
    s.id,
    'Mr. ' || (ARRAY[
        'Rolando','Ernesto','Rogelio','Ricardo','Fernando','Rodolfo','Mario','Alfredo','Manuel',
        'Nestor','Danilo','Cesar','Orlando','Bienvenido','Ramon','Salvador','Teodoro','Wilfredo'
    ])[1 + (s.id % 18)] || ' ' || s.last_name,
    'Mrs. ' || (ARRAY[
        'Teresita','Lourdes','Corazon','Rosario','Elena','Aurora','Marilou','Editha','Josefina',
        'Gloria','Evelyn','Norma','Lilia','Imelda','Cecilia','Myrna','Perlita','Erlinda'
    ])[1 + ((s.id + 7) % 18)] || ' ' || s.last_name,
    (ARRAY['Engineer','Teacher','Driver','OFW','Businessman','Farmer','Government Employee','Electrician','Carpenter','Technician'])[1 + (s.id % 10)],
    (ARRAY['Housewife','Teacher','Nurse','OFW','Businesswoman','Government Employee','Accountant','Store Owner'])[1 + (s.id % 8)],
    s.age + 26 + (s.id % 8),
    s.age + 23 + (s.id % 8),
    (ARRAY['College Graduate','High School Graduate','Vocational','Post Graduate'])[1 + (s.id % 4)],
    (ARRAY['College Graduate','High School Graduate','Vocational','Post Graduate'])[1 + ((s.id + 1) % 4)],
    NULL,
    s.cellphone,
    CASE
        WHEN (s.id % 10) < 3
            THEN (SELECT id FROM religions ORDER BY id LIMIT 1 OFFSET (s.id % 10))
        ELSE NULL
    END
FROM students s;

-- Previous school history for transferees and new students, matched to the
-- student's current level category. The school names are invented.
INSERT INTO school_history (student_id, school_level, school_name, school_address, year_attended)
SELECT
    s.id,
    CASE l.level_category
        WHEN 'kindergarten' THEN 'Kindergarten'
        WHEN 'elementary' THEN 'Elementary'
        WHEN 'junior_high' THEN 'Junior High School'
        ELSE 'Senior High School'
    END,
    CASE l.level_category
        WHEN 'kindergarten' THEN (ARRAY[
            'Seabreeze Learning House','Sunrise Cove Playschool','Little Harbor Kindergarten'
        ])[1 + (s.id % 3)]
        WHEN 'elementary' THEN (ARRAY[
            'Tidewater Elementary School','Lighthouse Point Integrated School','Coral Bay Elementary School'
        ])[1 + (s.id % 3)]
        WHEN 'junior_high' THEN (ARRAY[
            'Hillcrest Junior High School','Mango Grove Integrated School','Bayview Junior High School'
        ])[1 + (s.id % 3)]
        ELSE (ARRAY[
            'Northfield Senior High School','Harborlight Senior High School','Summit Ridge Senior High School'
        ])[1 + (s.id % 3)]
    END,
    CASE
        WHEN s.barangay IN ('Bago City','Valladolid','San Enrique','Pontevedra','La Carlota City')
            THEN s.barangay
        ELSE 'Pulupandan'
    END,
    (SELECT year_code FROM school_years
     WHERE start_date = (SELECT start_date FROM school_years WHERE is_current) - INTERVAL '1 year')
FROM students s
JOIN levels l ON l.id = s.current_level_id
WHERE s.classification IN ('Transferee', 'New');

-- ============================================================================
-- SECTION 9: SEED - ENROLLMENT HISTORY + ACCOUNTS (one account per year)
-- ============================================================================
-- One student row is one person (current enrollment). Returning students get
-- prior-year enrollment rows here - each producing its own account, payments,
-- and grades - so history is real without ever duplicating the person.
CREATE TEMP TABLE seed_enrollment (
    seq SERIAL PRIMARY KEY,
    student_id INT NOT NULL,
    school_year_id INT NOT NULL,
    level_id INT NOT NULL,
    year_offset INT NOT NULL,  -- school years before current (0 = current year)
    is_current_year BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE  -- the student's current enrollment
);

-- Primary enrollment: every student's current enrollment
INSERT INTO seed_enrollment (student_id, school_year_id, level_id, year_offset, is_current_year, is_primary)
SELECT s.id, s.school_year_id, s.current_level_id,
       (EXTRACT(YEAR FROM sy.start_date)::int - EXTRACT(YEAR FROM (SELECT start_date FROM school_years WHERE is_current))::int),
       sy.is_current, TRUE
FROM students s
JOIN school_years sy ON sy.id = s.school_year_id;

-- One year of history for returning students (one level down)
INSERT INTO seed_enrollment (student_id, school_year_id, level_id, year_offset, is_current_year, is_primary)
SELECT e.student_id, sy_prev.id, prev_level.id, e.year_offset - 1, FALSE, FALSE
FROM seed_enrollment e
JOIN school_years sy_cur ON sy_cur.id = e.school_year_id
JOIN school_years sy_prev ON sy_prev.start_date = sy_cur.start_date - INTERVAL '1 year'
JOIN levels l ON l.id = e.level_id
JOIN levels prev_level ON prev_level.level_order = l.level_order - 1
JOIN students s ON s.id = e.student_id
WHERE e.is_primary
  AND s.classification IN ('Old', 'Returning');

-- A second year of history, one more level down
INSERT INTO seed_enrollment (student_id, school_year_id, level_id, year_offset, is_current_year, is_primary)
SELECT e.student_id, sy_prev.id, prev_level.id, e.year_offset - 1, FALSE, FALSE
FROM seed_enrollment e
JOIN school_years sy_cur ON sy_cur.id = e.school_year_id
JOIN school_years sy_prev ON sy_prev.start_date = sy_cur.start_date - INTERVAL '1 year'
JOIN levels l ON l.id = e.level_id
JOIN levels prev_level ON prev_level.level_order = l.level_order - 1
WHERE NOT e.is_primary;

-- Accounts: one per enrollment row. Physical id order is history first and
-- current enrollment last, so "latest account" queries resolve to the current
-- enrollment. Display account IDs come from the sequence.
INSERT INTO accounts (
    account_id, account_number, student_id, school_year_id, level_id, payment_mode_id,
    total_school_fees, tuition_fee, monthly_tuition, initial_payment,
    discount, total_payments_made, total_balance,
    months_not_paid, unpaid_accounts, current_dues, due_date, posted_by
)
SELECT
    nextval('accounts_account_id_seq'),
    s.reg_number,
    se.student_id,
    se.school_year_id,
    se.level_id,
    pm.id,
    a.total_fee,
    a.tuition_fee,
    a.payable_monthly,
    CASE pm.mode_name
        WHEN 'Monthly' THEN a.upon_enrollment_monthly
        WHEN 'Quarterly' THEN a.upon_enrollment_quarterly
        WHEN 'Semi-Annual' THEN a.upon_enrollment_semi_annual
        ELSE a.total_fee
    END,
    0,
    0,
    a.total_fee,
    CASE pm.mode_name WHEN 'Monthly' THEN 10 ELSE 0 END,
    a.total_fee,
    CASE pm.mode_name WHEN 'Monthly' THEN a.payable_monthly ELSE 0 END,
    NULL,
    'admin'
FROM seed_enrollment se
JOIN students s ON s.id = se.student_id
JOIN payment_modes pm ON pm.mode_name = (
    CASE ((se.student_id * 3 + se.year_offset + 50) % 10)
        WHEN 6 THEN 'Quarterly'
        WHEN 7 THEN 'Quarterly'
        WHEN 8 THEN 'Semi-Annual'
        WHEN 9 THEN 'Cash/Annual'
        ELSE 'Monthly'
    END
)
JOIN assessments a ON a.level_id = se.level_id AND a.school_year_id = se.school_year_id
ORDER BY se.year_offset ASC, se.student_id ASC;

-- ============================================================================
-- SECTION 10: SEED - PAYMENTS (deterministic installment history)
-- ============================================================================
-- Past years are fully paid. The current year is mid-cycle: monthly payers
-- have paid most installments due so far (a few are behind), and a handful of
-- the most recent payments land on or near today so the Daily Collection
-- report is alive out of the box.
-- Every account receives an Initial Payment row below, so every student has at
-- least one payment linked to an account; non-cash plans get installments too.
WITH ctx0 AS (
    SELECT
        a.id AS account_id,
        a.student_id,
        a.initial_payment,
        a.total_school_fees,
        a.discount,
        pm.mode_name,
        pm.installments,
        sy.is_current,
        sy.start_date AS sy_start,
        ass.computer_fee,
        ass.payable_monthly,
        ass.payable_quarterly,
        ass.payable_semi_annual
    FROM accounts a
    JOIN payment_modes pm ON pm.id = a.payment_mode_id
    JOIN school_years sy ON sy.id = a.school_year_id
    JOIN assessments ass ON ass.level_id = a.level_id AND ass.school_year_id = a.school_year_id
),
ctx AS (
    SELECT ctx0.*,
        GREATEST(1, LEAST(10,
            (EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM ctx0.sy_start)::int) * 12
            + EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM ctx0.sy_start)::int + 1
        )) AS months_elapsed,
        st.status AS student_status
    FROM ctx0
    JOIN students st ON st.id = ctx0.student_id
),
plan AS (
    SELECT ctx.*,
        CASE ctx.mode_name WHEN 'Monthly' THEN 1 WHEN 'Quarterly' THEN 3 WHEN 'Semi-Annual' THEN 6 ELSE 0 END AS step_months,
        (CASE
            WHEN ctx.mode_name = 'Cash/Annual' THEN 0
            WHEN NOT ctx.is_current THEN ctx.installments
            WHEN ctx.student_status = 'dropped' THEN 1
            WHEN ctx.mode_name = 'Monthly' THEN GREATEST(LEAST(ctx.months_elapsed, ctx.installments) - (ctx.student_id % 3), 1)
            WHEN ctx.mode_name = 'Quarterly' THEN LEAST(CEIL(ctx.months_elapsed / 3.0), ctx.installments)::int
            ELSE CASE WHEN ctx.months_elapsed >= 6 THEN 1 + (ctx.student_id % 2) ELSE 1 END
        END)::int AS installments_paid
    FROM ctx
),
installments AS (
    SELECT
        p.account_id,
        p.student_id,
        p.mode_name,
        p.computer_fee,
        g,
        CASE
            WHEN p.is_current AND g = p.installments_paid AND (p.student_id % 17) < 4
                THEN CURRENT_DATE - (p.student_id % 3)
            ELSE LEAST(
                (p.sy_start + ((g - 1) * p.step_months) * INTERVAL '1 month' + (p.student_id % 9) * INTERVAL '1 day')::date,
                CURRENT_DATE)
        END AS payment_date,
        CASE p.mode_name
            WHEN 'Monthly' THEN p.payable_monthly
            WHEN 'Quarterly' THEN p.payable_quarterly
            ELSE p.payable_semi_annual
        END AS total_amount
    FROM plan p
    CROSS JOIN LATERAL generate_series(1, p.installments_paid) AS g
),
rows AS (
    SELECT
        account_id, student_id,
        CASE WHEN is_current
            THEN LEAST((sy_start + (student_id % 9) * INTERVAL '1 day')::date, CURRENT_DATE)
            ELSE (sy_start + (student_id % 9) * INTERVAL '1 day')::date
        END AS payment_date,
        NULL::varchar AS payment_month,
        'Initial Payment' AS description,
        initial_payment AS total_amount,
        0::numeric AS computer_amount,
        1 AS seq
    FROM plan
    UNION ALL
    SELECT
        i.account_id,
        i.student_id,
        i.payment_date,
        TO_CHAR(i.payment_date, 'FMMonth'),
        'Tuition',
        i.total_amount,
        CASE WHEN i.computer_fee > 0
            THEN ROUND(i.computer_fee / (CASE i.mode_name WHEN 'Monthly' THEN 10 WHEN 'Quarterly' THEN 4 ELSE 2 END), 2)
            ELSE 0
        END,
        2 AS seq
    FROM installments i
),
numbered AS (
    SELECT nextval('payments_payment_id_seq') AS pid, *
    FROM rows
)
INSERT INTO payments (
    payment_id, account_id, student_id, payment_date, receipt_number, payment_month, description,
    tuition_amount, computer_amount, registration_amount, miscellaneous_amount, books_amount, others_amount,
    total_amount, form_of_payment, amount_tendered, change_amount, posted_by
)
SELECT
    pid,
    account_id,
    student_id,
    payment_date,
    'AZR-' || LPAD(pid::text, 6, '0'),
    payment_month,
    description,
    total_amount - computer_amount,
    computer_amount,
    0, 0, 0, 0,
    total_amount,
    'Cash',
    total_amount,
    0,
    (ARRAY['cashier','registrar','admin'])[1 + (student_id % 3)]
FROM numbered
ORDER BY account_id, payment_date, seq;

-- A few non-student payments (document fees) so miscellaneous income shows up
-- in collections; some land within the last days so reports feel current.
WITH payer_rows AS (
    SELECT n.*, nextval('payments_payment_id_seq')::int AS pid
    FROM (VALUES
        (0,  'Mr. Alvin Tabora',       'Request of Transcript of Records', 150.00, 0.00),
        (1,  'Mrs. Lorna Dimaculangan','Certified True Copy of Report Card (2 pages)', 0.00, 120.00),
        (2,  'Ms. Rhea Manalo',        'Certificate of Enrollment - scholarship claim', 0.00, 80.00),
        (4,  'Mr. Noel Cabrera',       'Document Request Fee', 200.00, 0.00),
        (9,  'Mrs. Elisa Villamor',    'Certified True Copy of Report Card', 0.00, 90.00),
        (18, 'Mr. Emmanuel Cordova',   'Request of Transcript of Records', 150.00, 0.00),
        (40, 'Mrs. Perlita Sandoval',  'Authentication of Documents', 0.00, 160.00),
        (75, 'Atty. Victoriano Salazar','Certificate of Good Moral - employment', 0.00, 120.00)
    ) AS n(day_offset, payer_name, description, misc, others)
)
INSERT INTO payments (
    payment_id, account_id, student_id, payer_name, payment_date, receipt_number, payment_month, description,
    tuition_amount, computer_amount, registration_amount, miscellaneous_amount, books_amount, others_amount,
    total_amount, form_of_payment, amount_tendered, change_amount, posted_by
)
SELECT
    pid,
    NULL,
    NULL,
    payer_name,
    CURRENT_DATE - day_offset,
    'AZR-' || LPAD(pid::text, 6, '0'),
    TO_CHAR(CURRENT_DATE - day_offset, 'FMMonth'),
    description,
    0, 0, 0, misc, 0, others,
    misc + others,
    'Cash',
    misc + others,
    0,
    'cashier'
FROM payer_rows
ORDER BY day_offset;

-- Example reversals in a prior school year. The original rows stay untouched;
-- each reversal copies the account, student, and payer, negates every amount,
-- posts on its own date, and carries a required reason. Three prior-year
-- tuition payments are chosen deterministically.
WITH candidates AS (
    SELECT
        p.id,
        p.account_id,
        p.student_id,
        p.payer_name,
        p.payment_date,
        p.receipt_number,
        p.payment_month,
        p.form_of_payment,
        p.check_date,
        p.check_number,
        p.bank_name,
        p.branch,
        p.tuition_amount,
        p.computer_amount,
        p.registration_amount,
        p.miscellaneous_amount,
        p.books_amount,
        p.others_amount,
        p.total_amount,
        p.amount_tendered,
        p.change_amount,
        ROW_NUMBER() OVER (PARTITION BY p.student_id ORDER BY p.id) AS student_rank
    FROM payments p
    JOIN accounts a ON a.id = p.account_id
    JOIN school_years sy ON sy.id = a.school_year_id
    WHERE sy.is_current = FALSE
      AND p.entry_type = 'payment'
      AND p.description = 'Tuition'
),
targets AS (
    SELECT candidates.*, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM candidates
    WHERE student_rank = 1
    ORDER BY id
    LIMIT 3
),
numbered AS (
    SELECT t.*, nextval('payments_payment_id_seq')::int AS new_pid
    FROM targets t
)
INSERT INTO payments (
    payment_id, account_id, student_id, payer_name, payment_date, receipt_number, payment_month, description,
    tuition_amount, computer_amount, registration_amount, miscellaneous_amount, books_amount, others_amount,
    total_amount, form_of_payment, check_date, check_number, bank_name, branch,
    amount_tendered, change_amount, posted_by, entry_type, reverses_payment_id, reason
)
SELECT
    new_pid,
    account_id,
    student_id,
    payer_name,
    payment_date + 6,
    'AZV-' || LPAD(new_pid::text, 6, '0'),
    payment_month,
    'Reversal of ' || receipt_number,
    -tuition_amount,
    -computer_amount,
    -registration_amount,
    -miscellaneous_amount,
    -books_amount,
    -others_amount,
    -total_amount,
    form_of_payment,
    check_date,
    check_number,
    bank_name,
    branch,
    -amount_tendered,
    -change_amount,
    'admin',
    'reversal',
    id,
    CASE rn
        WHEN 1 THEN 'Duplicate posting: the same cash payment was recorded twice.'
        WHEN 2 THEN 'Posted to the wrong student account; the entry was cancelled.'
        ELSE 'Cash count discrepancy at end of day; the entry was cancelled after verification.'
    END
FROM numbered
ORDER BY rn;

-- Matching audit entries for the seeded reversals. The seed may insert audit
-- rows directly; the application writes them through lib/audit.ts.
INSERT INTO audit_log (occurred_at, user_id, username, action, entity_type, entity_id, summary, details)
SELECT
    r.payment_date + TIME '10:15',
    u.id,
    u.username,
    'payment.reverse',
    'payment',
    r.payment_id::text,
    'Reversed ' || o.receipt_number || ' with ' || r.receipt_number,
    jsonb_build_object(
        'studentId', r.student_id,
        'originalReceipt', o.receipt_number,
        'reversalReceipt', r.receipt_number,
        'amount', o.total_amount,
        'reason', r.reason
    )
FROM payments r
JOIN payments o ON o.id = r.reverses_payment_id
JOIN users u ON u.username = 'admin'
WHERE r.entry_type = 'reversal'
ORDER BY r.payment_date, r.id;

-- Update account balances from the payment history (single source of truth).
-- Mirrors recomputeAccountBalances() in lib/accounts.ts so seeded accounts
-- behave exactly like app-created ones. Amounts are signed sums: reversals
-- reduce the paid total and therefore raise the balance.
UPDATE accounts a SET
    total_payments_made = COALESCE(p.paid, 0),
    total_balance = GREATEST(a.total_school_fees - a.discount - COALESCE(p.paid, 0), 0),
    unpaid_accounts = GREATEST(a.total_school_fees - a.discount - COALESCE(p.paid, 0), 0),
    months_not_paid = CASE
        WHEN pm.mode_name = 'Monthly'
            THEN GREATEST(COALESCE(pm.installments, 10) - COALESCE(p.tuition_payments, 0), 0)
        ELSE 0
    END,
    current_dues = CASE
        WHEN pm.mode_name = 'Monthly'
            AND GREATEST(COALESCE(pm.installments, 10) - COALESCE(p.tuition_payments, 0), 0) > 0
            AND COALESCE(p.paid, 0) < (a.total_school_fees - a.discount)
            THEN a.monthly_tuition
        ELSE 0
    END,
    due_date = CASE
        WHEN GREATEST(a.total_school_fees - a.discount - COALESCE(p.paid, 0), 0) > 0
            THEN CURRENT_DATE + 15
        ELSE NULL
    END,
    last_updated = CURRENT_TIMESTAMP,
    posted_by = 'admin'
FROM payment_modes pm,
     (SELECT
         p.account_id,
         SUM(p.total_amount) AS paid,
         COUNT(*) FILTER (
             WHERE p.entry_type = 'payment'
               AND p.description = 'Tuition'
               AND NOT EXISTS (SELECT 1 FROM payments r WHERE r.reverses_payment_id = p.id)
         ) AS tuition_payments
      FROM payments p
      GROUP BY p.account_id
     ) p
WHERE a.id = p.account_id
  AND pm.id = a.payment_mode_id;

-- ============================================================================
-- SECTION 10b: SEED - GRADES (quarter grades per enrollment year)
-- ============================================================================
-- Past years have all four quarters posted. The current year posts quarters
-- as the school year progresses (Q1 from the 2nd month, Q2 from the 4th, Q3
-- from the 7th, Q4 from the 9th), so a mid-year database looks mid-year.
-- Senior High semesters are out of scope; every level uses four quarters.
WITH ctx AS (
    SELECT
        se.student_id,
        se.school_year_id,
        l.level_category,
        sy.is_current,
        GREATEST(1, LEAST(10,
            (EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM sy.start_date)::int) * 12
            + EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM sy.start_date)::int + 1
        )) AS months_elapsed
    FROM seed_enrollment se
    JOIN levels l ON l.id = se.level_id
    JOIN school_years sy ON sy.id = se.school_year_id
),
q AS (
    SELECT ctx.*,
        CASE
            WHEN NOT ctx.is_current THEN 4
            WHEN ctx.months_elapsed >= 9 THEN 4
            WHEN ctx.months_elapsed >= 7 THEN 3
            WHEN ctx.months_elapsed >= 4 THEN 2
            WHEN ctx.months_elapsed >= 2 THEN 1
            ELSE 0
        END AS quarters_posted
    FROM ctx
),
graded AS (
    SELECT
        q.student_id,
        sub.id AS subject_id,
        gp.id AS grade_period_id,
        q.school_year_id,
        CASE
            WHEN (q.student_id + sub.id) % 23 = 0 THEN 71 + ((q.student_id * 3 + sub.id) % 4)::numeric
            ELSE 80 + ((q.student_id * 7 + sub.id * 5 + gp.period_order * 3) % 17)::numeric
        END AS numeric_grade
    FROM q
    JOIN subjects sub ON sub.level_category = q.level_category
    JOIN grade_periods gp ON gp.school_year_id = q.school_year_id
      AND gp.period_order <= q.quarters_posted
)
INSERT INTO grades (student_id, subject_id, grade_period_id, school_year_id, numeric_grade, remarks, posted_by)
SELECT
    student_id,
    subject_id,
    grade_period_id,
    school_year_id,
    numeric_grade,
    CASE WHEN numeric_grade >= 75 THEN 'Passed' ELSE 'Failed' END,
    'registrar'
FROM graded;

-- ============================================================================
-- SECTION 11: VIEWS
-- ============================================================================

-- Balance inquiry view (latest account per student - a student may hold one
-- account per school year)
CREATE OR REPLACE VIEW v_balance_inquiry AS
SELECT
    s.id AS student_id,
    s.last_name,
    s.first_name,
    sy.year_code AS school_year,
    s.reg_number,
    l.level_name AS level,
    sec.section_name AS section,
    COALESCE(a.total_balance, 0) AS balance
FROM students s
LEFT JOIN LATERAL (
    SELECT acc.total_balance
    FROM accounts acc
    WHERE acc.student_id = s.id
    ORDER BY acc.id DESC
    LIMIT 1
) a ON TRUE
LEFT JOIN school_years sy ON s.school_year_id = sy.id
LEFT JOIN levels l ON s.current_level_id = l.id
LEFT JOIN sections sec ON s.current_section_id = sec.id
ORDER BY s.last_name, s.first_name;

-- Student list view
CREATE OR REPLACE VIEW v_student_list AS
SELECT
    s.id AS student_id,
    s.last_name,
    s.first_name,
    s.student_number AS stud_num,
    s.reg_number AS reg_num,
    l.level_name AS level,
    sy.year_code AS sy,
    s.date_enrolled AS enrolled,
    s.classification AS classif,
    s.telephone AS tel_num,
    s.cellphone AS cel_num,
    s.status
FROM students s
LEFT JOIN levels l ON s.current_level_id = l.id
LEFT JOIN school_years sy ON s.school_year_id = sy.id
ORDER BY s.last_name, s.first_name;

-- Payment history view
CREATE OR REPLACE VIEW v_payment_history AS
SELECT
    p.id,
    s.last_name || ', ' || s.first_name AS student_name,
    l.level_name AS level,
    p.payment_month AS months,
    p.payment_date AS date,
    p.receipt_number AS receipt,
    p.description,
    p.tuition_amount AS tuition,
    p.computer_amount AS computer,
    p.registration_amount AS reg,
    p.miscellaneous_amount AS misc,
    p.books_amount AS books,
    p.others_amount AS others,
    p.total_amount AS total,
    p.entry_type,
    p.reverses_payment_id,
    p.reason,
    p.posted_by
FROM payments p
JOIN accounts a ON p.account_id = a.id
JOIN students s ON a.student_id = s.id
LEFT JOIN levels l ON s.current_level_id = l.id;

-- ============================================================================
-- SECTION 12: GRANTS (for the application user, when script is run as postgres)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'isms_user') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA public TO isms_user';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO isms_user';
        EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO isms_user';
    END IF;
END $$;

-- Move each display sequence past the highest number written by the seed, so
-- the next nextval() is unused.
SELECT setval('students_reg_number_seq', (SELECT MAX(reg_number) FROM students));
SELECT setval('accounts_account_id_seq', (SELECT MAX(account_id) FROM accounts));
SELECT setval('payments_payment_id_seq', (SELECT MAX(payment_id) FROM payments));

-- ============================================================================
-- SECTION 13: SEED SUMMARY (verification output)
-- ============================================================================
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'school_years', COUNT(*) FROM school_years
UNION ALL SELECT 'levels', COUNT(*) FROM levels
UNION ALL SELECT 'sections', COUNT(*) FROM sections
UNION ALL SELECT 'payment_modes', COUNT(*) FROM payment_modes
UNION ALL SELECT 'subjects', COUNT(*) FROM subjects
UNION ALL SELECT 'grade_periods', COUNT(*) FROM grade_periods
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'parents', COUNT(*) FROM parents
UNION ALL SELECT 'school_history', COUNT(*) FROM school_history
UNION ALL SELECT 'assessments', COUNT(*) FROM assessments
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL SELECT 'grades', COUNT(*) FROM grades
ORDER BY table_name;

-- Data-quality checks: every "failures" value below should be 0.
SELECT 'students_without_accounts' AS check_name, COUNT(*) AS failures
FROM students s
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.student_id = s.id)
UNION ALL
SELECT 'students_without_payments', COUNT(*)
FROM students s
WHERE NOT EXISTS (
    SELECT 1
    FROM accounts a
    JOIN payments p ON p.account_id = a.id
    WHERE a.student_id = s.id
)
UNION ALL
SELECT 'accounts_without_payments', COUNT(*)
FROM accounts a
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.account_id = a.id)
UNION ALL
SELECT 'students_without_registration_numbers', COUNT(*)
FROM students
WHERE reg_number IS NULL
UNION ALL
SELECT 'duplicate_student_full_names', COUNT(*)
FROM (
    SELECT first_name, last_name
    FROM students
    GROUP BY first_name, last_name
    HAVING COUNT(*) > 1
) duplicates
UNION ALL
SELECT 'levels_with_fewer_than_18_students', COUNT(*)
FROM (
    SELECT l.id
    FROM levels l
    LEFT JOIN students s ON s.current_level_id = l.id
    GROUP BY l.id
    HAVING COUNT(s.id) < 18
) low_levels
UNION ALL
SELECT 'payments_reversed_more_than_once', COUNT(*)
FROM (
    SELECT reverses_payment_id
    FROM payments
    WHERE reverses_payment_id IS NOT NULL
    GROUP BY reverses_payment_id
    HAVING COUNT(*) > 1
) repeated_reversals;
