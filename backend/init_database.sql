-- 堡垒机授权检查系统数据库初始化脚本
-- 排序规则: utf8mb4_general_ci

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS `bastion_audit` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_general_ci;

USE `bastion_audit`;

-- 1. 校验规则表
CREATE TABLE IF NOT EXISTS `validation_rules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    `rule_type` VARCHAR(50) NOT NULL COMMENT '规则类型: ops_personnel, long_time_setting, prod_env_pattern, master_db_ips',
    `rule_key` VARCHAR(100) NOT NULL COMMENT '规则键名',
    `rule_value` JSON NOT NULL COMMENT '规则值(JSON格式)',
    `description` TEXT COMMENT '规则描述',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX `idx_rule_type` (`rule_type`),
    INDEX `idx_rule_type_key` (`rule_type`, `rule_key`),
    UNIQUE KEY `uk_rule_type_key` (`rule_type`, `rule_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='校验规则表';

-- 2. 授权记录表
CREATE TABLE IF NOT EXISTS `authorization_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    `person_name` VARCHAR(100) NOT NULL COMMENT '人员姓名',
    `host_ip` VARCHAR(50) NOT NULL COMMENT '主机IP',
    `host_name` VARCHAR(200) NOT NULL COMMENT '主机名称',
    `host_network` VARCHAR(200) COMMENT '主机网络',
    `host_group` VARCHAR(200) COMMENT '主机组',
    `protocol` VARCHAR(20) COMMENT '协议',
    `account_login_name` VARCHAR(100) COMMENT '账户登录名',
    `check_time` DATETIME NOT NULL COMMENT '检查时间',
    `is_marked_deletion` BOOLEAN DEFAULT FALSE COMMENT '是否标记删除',
    `deletion_reason` TEXT COMMENT '删除原因',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX `idx_person_name` (`person_name`),
    INDEX `idx_host_ip` (`host_ip`),
    INDEX `idx_host_name` (`host_name`),
    INDEX `idx_check_time` (`check_time`),
    INDEX `idx_is_marked_deletion` (`is_marked_deletion`),
    INDEX `idx_person_host` (`person_name`, `host_ip`, `host_name`, `protocol`, `account_login_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='授权记录表';

-- 3. 检查历史表
CREATE TABLE IF NOT EXISTS `check_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    `check_time` DATETIME NOT NULL COMMENT '检查时间',
    `total_records` INT DEFAULT 0 COMMENT '总记录数',
    `marked_deletions` INT DEFAULT 0 COMMENT '标记删除数',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX `idx_check_time` (`check_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='检查历史表';

-- 初始化默认规则数据（如果不存在）
INSERT INTO `validation_rules` (`rule_type`, `rule_key`, `rule_value`, `description`) VALUES
('ops_personnel', 'default', '{"personnel": []}', '运维人员列表'),
('long_time_setting', 'default', '{"days": 30}', '长时间权限设置（天数）'),
('prod_env_pattern', 'contains_prd', '{"type": "contains", "value": "prd"}', '生产环境判断：主机名包含prd'),
('prod_env_pattern', 'contains_outpub', '{"type": "contains", "value": "outpub"}', '生产环境判断：主机名包含outpub'),
('master_db_ips', 'default', '{"single_ips": ["192.168.240.181", "192.168.240.156"], "ip_ranges": []}', '主数据库IP列表')
ON DUPLICATE KEY UPDATE `rule_value` = VALUES(`rule_value`), `description` = VALUES(`description`);

