CREATE DATABASE PetShopManagement;
GO
USE PetShopManagement;
GO
-- 1. Bảng Role (Vai trò)
CREATE TABLE Role (
    role_id NVARCHAR(8) PRIMARY KEY,
    role_status NVARCHAR(32) NOT NULL
);

-- 2. Bảng Category (Danh mục sản phẩm)
CREATE TABLE Category (
    category_id NVARCHAR(8) PRIMARY KEY,
    category_name NVARCHAR(32) NOT NULL,
	category_icon NVARCHAR(50)
);

-- 3. Bảng User (Người dùng)
CREATE TABLE [User] (
    user_id INT IDENTITY(1,1) PRIMARY KEY, 
    role_id NVARCHAR(8) NOT NULL,
    full_name NVARCHAR(255) NOT NULL,
    date_of_birth DATE,
    sex CHAR(1),
    email VARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL, -- Xài bcrypt
    status NVARCHAR(255),
    CONSTRAINT FK_User_Role FOREIGN KEY (role_id) REFERENCES Role(role_id)
);

-- 4. Bảng Product (Sản phẩm)
CREATE TABLE Product (
    product_id INT IDENTITY(1,1) PRIMARY KEY,
    category_id NVARCHAR(8) NOT NULL,
    product_name NVARCHAR(255) NOT NULL,
    price DECIMAL(18, 2) NOT NULL,
    num_product INT DEFAULT 0,
	image_url NVARCHAR(MAX),
    detail_product NVARCHAR(255),
    CONSTRAINT FK_Product_Category FOREIGN KEY (category_id) REFERENCES Category(category_id)
);

-- 5. Bảng Order (Đơn hàng)
CREATE TABLE [Order] (
    order_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    order_date DATE DEFAULT GETDATE(),
    status_order NVARCHAR(32),
    total_price DECIMAL(18, 2),
    prods_per_order INT,
    CONSTRAINT FK_Order_User FOREIGN KEY (user_id) REFERENCES [User](user_id)
);

-- 6. Bảng Order-item (Chi tiết đơn hàng)
CREATE TABLE Order_Item (
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    num_per_prod INT NOT NULL,
    unit_price VARCHAR(32), -- Có thể đổi thành DECIMAL nếu lưu giá thực tế
    PRIMARY KEY (order_id, product_id),
    CONSTRAINT FK_OrderItem_Order FOREIGN KEY (order_id) REFERENCES [Order](order_id),
    CONSTRAINT FK_OrderItem_Product FOREIGN KEY (product_id) REFERENCES Product(product_id)
);

-- 7. Bảng Feedback (Đánh giá)
CREATE TABLE Feedback (
    feedback_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    content NVARCHAR(255),
    rating DECIMAL(2, 1),
    feedback_date DATE DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_User FOREIGN KEY (user_id) REFERENCES [User](user_id),
    CONSTRAINT FK_Feedback_Product FOREIGN KEY (product_id) REFERENCES Product(product_id)
);

-- 8. Bảng Chat-history (Lịch sử trợ lý ảo)
CREATE TABLE Chat_History (
    chat_id INT IDENTITY(1,255) PRIMARY KEY,
    user_id INT NULL, -- NULL cho Guest
    question NVARCHAR(MAX),
    answer NVARCHAR(MAX),
    chat_time TIMESTAMP, -- Hoặc DATETIME
    CONSTRAINT FK_Chat_User FOREIGN KEY (user_id) REFERENCES [User](user_id)
);

-- 9. Bảng PCC-campaign (Chiến dịch quảng cáo)
CREATE TABLE PCC_Campaign (
    campaign_id INT IDENTITY(1,255) PRIMARY KEY,
    creator_id INT NOT NULL, 
	product_id INT NOT NULL, 
	banner_url NVARCHAR(MAX),
    campaign_name NVARCHAR(255),
    budget DECIMAL(18, 2),
    cost_per_click DECIMAL(18, 2),
    status NVARCHAR(32),
    num_of_clicks INT DEFAULT 0,
    CONSTRAINT FK_PCC_Admin FOREIGN KEY (creator_id) REFERENCES [User](user_id),
	CONSTRAINT FK_PCC_Product FOREIGN KEY (product_id) REFERENCES Product(product_id),
);
GO
INSERT INTO Role (role_id, role_status) VALUES 
('CUS', 'Customer'),
('STA', 'Staff'),
('ADM', 'Admin');
INSERT INTO [User] (role_id, full_name, email, password, status)
VALUES ('ADM', N'Quản trị viên trưởng', 'admin@fellua.com', 'lmao', 'Active');

INSERT INTO Category (category_id, category_name) VALUES  
('ACC', N'Phụ kiện & Đồ dùng'), ('CAT', N'Mèo'), 
('BIRD', N'Chim'), ('HAM', N'Chuột'), 
('DOG', N'Chó'), ('FISH', N'Cá'), 
('RAB', N'Thỏ'), ('REP', N'Bò sát');
GO


INSERT INTO Product (category_id, product_name, price, num_product, detail_product, image_url) VALUES 
('ACC', N'Hạt Royal Canin cho mèo con', 150000, 100, N'Dinh dưỡng tối ưu cho mèo dưới 12 tháng tuổi.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767523627/shopping_ym8ewo.webp'),
('ACC', N'Pate Gan Gà cho chó', 35000, 150, N'Pate thơm ngon, cung cấp protein dồi dào.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539447/shopping_tjvat2.avif'),
('ACC', N'Cỏ mèo tươi (Catnip)', 20000, 50, N'Giúp mèo thư giãn và hỗ trợ tiêu hóa.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539497/t%E1%BA%A3i_xu%E1%BB%91ng_1_hp808q.jpg'),
('ACC', N'Cần câu mèo gắn lông vũ', 35000, 80, N'Đồ chơi tương tác giúp mèo năng động hơn.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767536488/t%E1%BA%A3i_xu%E1%BB%91ng_dvpz5e.jpg'),
('ACC', N'Bóng cao su đặc cho chó', 45000, 120, N'Bền bỉ, chống cắn phá, giúp chó giải trí.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539435/shopping_1_uytjo6.avif'),
('ACC', N'Đường hầm cho Hamster', 95000, 30, N'Tạo không gian trú ẩn và vui chơi cho chuột.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539439/shopping_2_gbujtb.avif'),
('ACC', N'Áo nỉ sọc cho thú cưng', 110000, 45, N'Chất vải co giãn, nhiều size cho chó và mèo.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539442/shopping_3_wody7j.avif'),
('ACC', N'Cát vệ sinh đậu nành 6L', 135000, 60, N'Thấm hút cực tốt, khử mùi hiệu quả, an toàn.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539451/shopping_muiob7.webp'),
('ACC', N'Lược chải lông lấy lông thừa', 65000, 70, N'Giảm tình trạng lông rụng khắp nhà.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539514/t%E1%BA%A3i_xu%E1%BB%91ng_x14i4y.jpg'),
('ACC', N'Vòng cổ định vị GPS', 850000, 10, N'Phụ kiện cao cấp giúp theo dõi vị trí thú cưng.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767539516/t%E1%BA%A3i_xu%E1%BB%91ng_2_csk4q4.jpg');

GO
INSERT INTO Product (category_id, product_name, price, num_product, detail_product, image_url) VALUES 
-- 1. NHÓM CHÓ (DOG)
('DOG', N'Chó Husky Siberian', 8000000, 5, N'Mắt xanh, năng động, thích hợp gia đình có sân vườn.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541368/t%E1%BA%A3i_xu%E1%BB%91ng_ihx386.jpg'),
('DOG', N'Chó Phốc Sóc (Pomeranian)', 5500000, 8, N'Nhỏ nhắn, lông xù, thông minh và quấn chủ.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541420/t%E1%BA%A3i_xu%E1%BB%91ng_1_fzrtvr.jpg'),
('DOG', N'Chó Golden Retriever', 7000000, 4, N'Hiền lành, trung thành, cực kỳ thông minh.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541420/t%E1%BA%A3i_xu%E1%BB%91ng_1_fzrtvr.jpg'),

-- 2. NHÓM MÈO (CAT)
('CAT', N'Mèo Anh Lông Ngắn', 4500000, 10, N'Tính cách điềm tĩnh, mặt tròn, dễ chăm sóc.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541547/download_ftsfm9.jpg'),
('CAT', N'Mèo Munchkin chân ngắn', 9500000, 3, N'Đáng yêu với đôi chân ngắn, tinh nghịch.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541573/download_k3mfgj.jpg'),
('CAT', N'Mèo Ba Tư (Persian)', 6000000, 5, N'Lông dài quý phái, cần được chải chuốt thường xuyên.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541674/download_sd7zsq.jpg'),

-- 3. NHÓM CHIM (BIRD)
('BIRD', N'Vẹt Cockatiel', 1500000, 12, N'Vẹt có mào, có thể học huýt sáo và nói từ đơn.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541726/download_cepz8q.jpg'),
('BIRD', N'Chim Yến Phụng', 250000, 30, N'Màu sắc rực rỡ, dễ nuôi, thích hợp cho người mới.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541785/download_aw3r3a.jpg'),
('BIRD', N'Chim Khuyên', 500000, 10, N'Giọng hót hay, nhỏ nhắn, nhanh nhẹn.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541831/download_wglwrx.jpg'),

-- 4. NHÓM CHUỘT (HAM)
('HAM', N'Chuột Lang (Guinea Pig)', 300000, 15, N'Hiền lành, kích thước lớn hơn Hamster, thích ăn rau.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541872/download_omhum3.jpg'),
('HAM', N'Hamster Winter White', 100000, 50, N'Nhỏ nhắn, có thể đổi màu lông theo mùa.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767541968/download_p1dfwi.jpg'),
('HAM', N'Hamster Bear', 150000, 25, N'Kích thước lớn, nhiều màu sắc, rất thân thiện.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542013/download_idkyq4.jpg'),

-- 5. NHÓM CÁ CẢNH (FISH)
('FISH', N'Cá vàng Ranchu', 200000, 20, N'Dáng bơi ngộ nghĩnh, không có vây lưng.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542055/download_fqenmt.jpg'),
('FISH', N'Cá Betta Halfmoon', 120000, 40, N'Vây đuôi xòe rộng rực rỡ như đóa hoa.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542237/download_hzaysf.jpg'),
('FISH', N'Cá Koi Nhật', 500000, 15, N'Biểu tượng của may mắn, thích hợp nuôi hồ bóng mát.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542395/download_n4gibv.jpg'),

-- 6. NHÓM THỎ (RAB)
('RAB', N'Thỏ Woody Toy', 500000, 10, N'Giống thỏ lùn, lông xù mềm mại như bông.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542444/download_qudysr.jpg'),
('RAB', N'Thỏ Holland Lop (Tai cụp)', 800000, 6, N'Đôi tai rủ xuống cực kỳ đáng yêu, thân thiện.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542507/download_qanuzz.jpg'),
('RAB', N'Thỏ Lionhead', 600000, 8, N'Có bờm lông quanh cổ giống sư tử.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542548/download_cfpc7k.jpg'),

-- 7. NHÓM BÒ SÁT (REP)
('REP', N'Rồng Nam Mỹ (Iguana)', 1300000, 5, N'Màu xanh rực rỡ, ăn thực vật, vẻ ngoài cực ngầu.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542625/download_mah2ma.jpg'),
('REP', N'Tắc kè Leopard Gecko', 850000, 12, N'Da hoa văn báo đốm, dễ chăm sóc, không gây tiếng ồn.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542661/download_dwipkb.jpg'),
('REP', N'Rồng Úc (Bearded Dragon)', 2500000, 4, N'Thông minh, có thể tương tác tốt với chủ.', 'https://res.cloudinary.com/dzipisbon/image/upload/v1767542702/download_whb3ow.jpg');

GO

CREATE FUNCTION dbo.fn_GetTodayChatCount (@userId INT)
RETURNS INT
AS
BEGIN
    DECLARE @count INT;
    SELECT @count = COUNT(*) 
    FROM Chat_History 
    WHERE user_id = @userId 
    AND CAST(chat_time AS DATE) = CAST(GETDATE() AS DATE);
    RETURN @count;
END;
GO

UPDATE Category SET category_icon = N'🐶' WHERE category_id = 'DOG';
UPDATE Category SET category_icon = N'🐱' WHERE category_id = 'CAT';
UPDATE Category SET category_icon = N'🐦' WHERE category_id = 'BIRD';
UPDATE Category SET category_icon = N'🐹' WHERE category_id = 'HAM';
UPDATE Category SET category_icon = N'🦴' WHERE category_id = 'ACC';
UPDATE Category SET category_icon = N'🐟' WHERE category_id = 'FISH';
UPDATE Category SET category_icon = N'🐰' WHERE category_id = 'RAB';
UPDATE Category SET category_icon = N'🦎' WHERE category_id = 'REP';

