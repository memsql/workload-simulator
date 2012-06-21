-- This is the schema file from the video. We left
-- Engine=InnoDB in the create table statements so that
-- if you plug this biginto MySQL, you'll use InnoDB. MemSQL
-- just ignores this directive.
--

drop database if exists video;
create database video;
use video;

drop table if exists warehouse;
create table warehouse (
    w_id bigint not null,
    w_name varchar(10), 
    w_street_1 varchar(20), 
    w_street_2 varchar(20), 
    w_city varchar(20), 
    w_state char(2), 
    w_zip char(9), 
    w_tax decimal(4,2), 
    w_ytd decimal(12,2),
    primary key (w_id) ) Engine=InnoDB;

drop table if exists district;
create table district (
    d_id bigint not null, 
    d_w_id bigint not null, 
    d_name varchar(10), 
    d_street_1 varchar(20), 
    d_street_2 varchar(20), 
    d_city varchar(20), 
    d_state char(2), 
    d_zip char(9), 
    d_tax decimal(4,2), 
    d_ytd decimal(12,2), 
    d_next_o_id bigint,
    primary key (d_w_id, d_id) ) Engine=InnoDB;

drop table if exists customer;
create table customer (
    c_id bigint not null, 
    c_d_id bigint not null,
    c_w_id bigint not null, 
    c_first varchar(16), 
    c_middle char(2), 
    c_last varchar(16), 
    c_street_1 varchar(20), 
    c_street_2 varchar(20), 
    c_city varchar(20), 
    c_state char(2), 
    c_zip char(9), 
    c_phone char(16), 
    c_since datetime, 
    c_credit char(2), 
    c_credit_lim bigint, 
    c_discount decimal(4,2), 
    c_balance decimal(12,2), 
    c_ytd_payment decimal(12,2), 
    c_payment_cnt bigint, 
    c_delivery_cnt bigint, 
    c_data text,
    PRIMARY KEY(c_w_id, c_d_id, c_id) ) Engine=InnoDB;

drop table if exists history;
create table history (
    h_c_id bigint, 
    h_c_d_id bigint, 
    h_c_w_id bigint,
    h_d_id bigint,
    h_w_id bigint,
    h_date datetime,
    h_amount decimal(6,2), 
    h_data varchar(24)) Engine=InnoDB;

drop table if exists new_orders;
create table new_orders (
    no_o_id bigint not null,
    no_d_id bigint not null,
    no_w_id bigint not null,
    PRIMARY KEY(no_w_id, no_d_id, no_o_id)) Engine=InnoDB;

drop table if exists orders;
create table orders (
    o_id bigint not null, 
    o_d_id bigint not null, 
    o_w_id bigint not null,
    o_c_id bigint,
    o_entry_d datetime,
    o_carrier_id bigint,
    o_ol_cnt bigint, 
    o_all_local bigint,
    PRIMARY KEY(o_w_id, o_d_id, o_id) ) Engine=InnoDB ;

drop table if exists order_line;
create table order_line ( 
    ol_o_id bigint not null, 
    ol_d_id bigint not null,
    ol_w_id bigint not null,
    ol_number bigint not null,
    ol_i_id bigint, 
    ol_supply_w_id bigint,
    ol_delivery_d datetime, 
    ol_quantity bigint, 
    ol_amount decimal(6,2), 
    ol_dist_info char(24),
    PRIMARY KEY(ol_w_id, ol_d_id, ol_o_id, ol_number) ) Engine=InnoDB ;

drop table if exists item;
create table item (
    i_id bigint not null, 
    i_im_id bigint, 
    i_name varchar(24), 
    i_price decimal(5,2), 
    i_data varchar(50),
    PRIMARY KEY(i_id) ) Engine=InnoDB;

drop table if exists stock;
create table stock (
    s_i_id bigint not null, 
    s_w_id bigint not null, 
    s_quantity bigint, 
    s_dist_01 char(24), 
    s_dist_02 char(24),
    s_dist_03 char(24),
    s_dist_04 char(24), 
    s_dist_05 char(24), 
    s_dist_06 char(24), 
    s_dist_07 char(24), 
    s_dist_08 char(24), 
    s_dist_09 char(24), 
    s_dist_10 char(24), 
    s_ytd decimal(8,0), 
    s_order_cnt bigint, 
    s_remote_cnt bigint,
    s_data varchar(50),
    PRIMARY KEY(s_w_id, s_i_id) ) Engine=InnoDB ;

CREATE INDEX idx_customer ON customer (c_w_id,c_d_id,c_last,c_first);
CREATE INDEX idx_orders ON orders (o_w_id,o_d_id,o_c_id,o_id);
CREATE INDEX fkey_stock_2 ON stock (s_i_id);
CREATE INDEX fkey_order_line_2 ON order_line (ol_supply_w_id,ol_i_id);
