-- Web-Scan Database Schema
-- This schema supports all new features: monitoring, CVSS scoring, API security, compliance, ML, and plugins

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and multi-tenant support
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}'
);

-- Organizations for team management
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User-Organization relationships
CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id)
);

-- Scan history table
CREATE TABLE scan_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    target_url TEXT NOT NULL,
    scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('full', 'quick', 'custom', 'api', 'compliance')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    scan_results JSONB,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual scan results for detailed analysis
CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
    endpoint_name VARCHAR(100) NOT NULL,
    result_data JSONB NOT NULL,
    execution_time INTEGER, -- in milliseconds
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring configurations
CREATE TABLE monitoring_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    target_url TEXT NOT NULL,
    scan_type VARCHAR(50) DEFAULT 'quick' CHECK (scan_type IN ('full', 'quick', 'custom')),
    schedule VARCHAR(50) NOT NULL, -- cron expression
    is_active BOOLEAN DEFAULT true,
    alert_email BOOLEAN DEFAULT true,
    alert_sms BOOLEAN DEFAULT false,
    webhook_url TEXT,
    alert_thresholds JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_run_at TIMESTAMP WITH TIME ZONE
);

-- Monitoring results and history
CREATE TABLE monitoring_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES monitoring_configs(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_history(id) ON DELETE SET NULL,
    status_changes JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    security_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vulnerability assessments with CVSS scoring
CREATE TABLE vulnerability_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
    cve_id VARCHAR(20),
    vulnerability_name VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high', 'critical')),
    cvss_score DECIMAL(3,1),
    cvss_vector TEXT,
    attack_vector VARCHAR(50),
    attack_complexity VARCHAR(50),
    privileges_required VARCHAR(50),
    user_interaction VARCHAR(50),
    scope VARCHAR(50),
    confidentiality_impact VARCHAR(50),
    integrity_impact VARCHAR(50),
    availability_impact VARCHAR(50),
    remediation TEXT,
    references JSONB DEFAULT '[]',
    affected_components JSONB DEFAULT '[]',
    is_exploitable BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API security testing results
CREATE TABLE api_security_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
    endpoint_url TEXT NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')),
    api_type VARCHAR(50) DEFAULT 'rest' CHECK (api_type IN ('rest', 'graphql', 'soap')),
    vulnerability_type VARCHAR(100) NOT NULL,
    owasp_category VARCHAR(100),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    description TEXT,
    proof_of_concept TEXT,
    remediation TEXT,
    request_data JSONB,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance frameworks and assessments
CREATE TABLE compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20),
    description TEXT,
    requirements JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance assessments
CREATE TABLE compliance_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
    framework_id UUID REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    overall_score DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    assessment_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual compliance requirement results
CREATE TABLE compliance_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES compliance_assessments(id) ON DELETE CASCADE,
    requirement_id VARCHAR(100) NOT NULL,
    requirement_name TEXT NOT NULL,
    category VARCHAR(100),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pass', 'fail', 'warning', 'not_applicable', 'not_tested')),
    score DECIMAL(5,2),
    evidence JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ML models and training data
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('anomaly_detection', 'behavioral_analysis', 'predictive_scoring')),
    version VARCHAR(20) NOT NULL,
    model_data BYTEA, -- stored model binary
    training_data_size INTEGER,
    accuracy DECIMAL(5,2),
    precision DECIMAL(5,2),
    recall DECIMAL(5,2),
    f1_score DECIMAL(5,2),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ML predictions and anomaly detection results
CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
    prediction_type VARCHAR(50) NOT NULL CHECK (prediction_type IN ('anomaly', 'risk_score', 'behavioral_pattern')),
    confidence_score DECIMAL(5,2),
    prediction_data JSONB NOT NULL,
    is_anomaly BOOLEAN DEFAULT false,
    anomaly_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Plugin system
CREATE TABLE plugins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    author VARCHAR(100),
    is_official BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    settings_schema JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User plugin installations
CREATE TABLE user_plugins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Plugin execution results
CREATE TABLE plugin_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    user_plugin_id UUID REFERENCES user_plugins(id) ON DELETE CASCADE,
    execution_time INTEGER, -- in milliseconds
    result_data JSONB,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX idx_scan_history_status ON scan_history(status);
CREATE INDEX idx_scan_history_created_at ON scan_history(created_at);
CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_monitoring_configs_user_id ON monitoring_configs(user_id);
CREATE INDEX idx_monitoring_configs_active ON monitoring_configs(is_active);
CREATE INDEX idx_monitoring_results_config_id ON monitoring_results(config_id);
CREATE INDEX idx_vulnerability_assessments_scan_id ON vulnerability_assessments(scan_id);
CREATE INDEX idx_vulnerability_assessments_severity ON vulnerability_assessments(severity);
CREATE INDEX idx_api_security_results_scan_id ON api_security_results(scan_id);
CREATE INDEX idx_compliance_assessments_organization_id ON compliance_assessments(organization_id);
CREATE INDEX idx_compliance_assessments_framework_id ON compliance_assessments(framework_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_ml_predictions_scan_id ON ml_predictions(scan_id);
CREATE INDEX idx_ml_predictions_model_id ON ml_predictions(model_id);
CREATE INDEX idx_user_plugins_user_id ON user_plugins(user_id);
CREATE INDEX idx_user_plugins_plugin_id ON user_plugins(plugin_id);

-- Insert default compliance frameworks
INSERT INTO compliance_frameworks (name, slug, version, description, requirements) VALUES
('GDPR', 'gdpr', '2018', 'General Data Protection Regulation', '[]'),
('HIPAA', 'hipaa', '1996', 'Health Insurance Portability and Accountability Act', '[]'),
('PCI-DSS', 'pci-dss', '4.0', 'Payment Card Industry Data Security Standard', '[]'),
('SOC2', 'soc2', '2017', 'Service Organization Control 2', '[]');

-- Insert default plugins
INSERT INTO plugins (name, slug, version, description, author, is_official) VALUES
('OWASP ZAP Integration', 'owasp-zap', '1.0.0', 'Integration with OWASP ZAP for advanced security testing', 'Web-Scan Team', true),
('Burp Suite Connector', 'burp-suite', '1.0.0', 'Connect to Burp Suite for manual testing integration', 'Web-Scan Team', true),
('Slack Notifications', 'slack-notifications', '1.0.0', 'Send security alerts to Slack channels', 'Web-Scan Team', true),
('Jira Integration', 'jira-integration', '1.0.0', 'Create Jira tickets for security issues', 'Web-Scan Team', true);
