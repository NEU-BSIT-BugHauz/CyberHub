-- 002_auth_sessions.sql
-- S1-DBA-03: PostgreSQL-backed Express session store (from S1-DEV-03_auth_sessions.sql)

CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR(255) PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
  ON user_sessions (expire);

  CREATE TABLE IF NOT EXISTS employee (
  empno VARCHAR(5) NOT NULL PRIMARY KEY,
  lastname VARCHAR(15),
  firstname VARCHAR(15),
  gender CHAR(1) CONSTRAINT gender_ck CHECK (gender IN ('M', 'F')),
  birthdate DATE,
  hiredate DATE,
  sepDate DATE
);

CREATE TABLE IF NOT EXISTS department (
  deptCode VARCHAR(3) NOT NULL PRIMARY KEY,
  deptName VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS job (
  jobCode VARCHAR(4) NOT NULL PRIMARY KEY,
  jobDesc VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS jobHistory (
  empNo VARCHAR(5) NOT NULL REFERENCES employee,
  jobCode VARCHAR(4) NOT NULL REFERENCES job,
  effDate DATE NOT NULL,
  salary DECIMAL(10,2) CONSTRAINT salary_ck CHECK (salary >= 0.0),
  deptCode VARCHAR(4),
  PRIMARY KEY (empNo, jobCode, effDate),
  FOREIGN KEY (deptCode) REFERENCES department
);
