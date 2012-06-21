create database if not exists key_value;
use key_value;

DROP TABLE IF EXISTS `kv`;
CREATE TABLE `kv` (
  `k` bigint(20) NOT NULL,
  `v` varbinary(64) DEFAULT NULL,
  PRIMARY KEY (`k`) USING HASH
);
