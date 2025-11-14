-- Create notification tables directly

CREATE TABLE IF NOT EXISTS certs_emailconfig (
    id BIGSERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL DEFAULT 'smtp',
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_username VARCHAR(255),
    smtp_password VARCHAR(255),
    smtp_use_tls BOOLEAN DEFAULT TRUE,
    smtp_from_email VARCHAR(254),
    graph_tenant_id VARCHAR(255),
    graph_client_id VARCHAR(255),
    graph_client_secret VARCHAR(255),
    graph_from_email VARCHAR(254),
    daily_check_time TIME NOT NULL DEFAULT '09:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certs_notificationconfig (
    id BIGSERIAL PRIMARY KEY,
    team_id INTEGER UNIQUE REFERENCES certs_team(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT FALSE,
    recipients JSONB DEFAULT '[]',
    notify_expiring BOOLEAN DEFAULT TRUE,
    expiry_thresholds JSONB DEFAULT '[]',
    notify_expired BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_global_notif_config
ON certs_notificationconfig(is_global)
WHERE is_global = TRUE;

CREATE TABLE IF NOT EXISTS certs_certificatenotification (
    id BIGSERIAL PRIMARY KEY,
    certificate_id INTEGER UNIQUE NOT NULL REFERENCES certs_certificate(id) ON DELETE CASCADE,
    override_enabled BOOLEAN DEFAULT FALSE,
    recipients JSONB DEFAULT '[]',
    notify_expiring BOOLEAN DEFAULT TRUE,
    expiry_thresholds JSONB DEFAULT '[]',
    notify_expired BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certs_secretnotification (
    id BIGSERIAL PRIMARY KEY,
    secret_id INTEGER UNIQUE NOT NULL REFERENCES certs_secret(id) ON DELETE CASCADE,
    override_enabled BOOLEAN DEFAULT FALSE,
    recipients JSONB DEFAULT '[]',
    notify_expiring BOOLEAN DEFAULT TRUE,
    expiry_thresholds JSONB DEFAULT '[]',
    notify_expired BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certs_notificationlog (
    id BIGSERIAL PRIMARY KEY,
    notification_type VARCHAR(20) NOT NULL,
    resource_type VARCHAR(20) NOT NULL,
    resource_id INTEGER NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    recipients JSONB NOT NULL,
    days_until_expiry INTEGER,
    status VARCHAR(10) DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notif_log_sent_at_idx ON certs_notificationlog(sent_at DESC);
CREATE INDEX IF NOT EXISTS notif_log_resource_idx ON certs_notificationlog(resource_type, resource_id);
