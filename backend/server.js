const express = require('express');
const sql = require('mssql');
const { GoogleGenAI } = require("@google/genai");
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
app.use(cors());
app.use(express.json());

// Cấu hình SQL Server
const dbConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    server: process.env.SQL_SERVER,
    options: { encrypt: false, trustServerCertificate: true }
};

cloudinary.config({
    cloud_name: 'dzipisbon',
    api_key: '885293945594758',
    api_secret: '0HIHiK_J_H4ockYERk5pGNCQHkY'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'pet-shop-products',
        allowed_formats: ['jpg', 'png', 'webp']
    }
});

const fetchOrders = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/admin/orders');
        console.log("Dữ liệu nhận được:", res.data); 
        setOrders(res.data);
    } catch (err) {
        console.error("Chi tiết lỗi:", err);
        alert("Lỗi tải danh sách đơn hàng");
    }
};

const upload = multer({ storage: storage });

// API Thêm sản phẩm mới kèm ảnh (C10)
app.post('/api/admin/products', upload.single('image'), async (req, res) => {
    try {
        const { categoryId, productName, price, numProduct, detailProduct } = req.body;
        const imageUrl = req.file ? req.file.path : null; // Link ảnh từ Cloudinary

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('catId', sql.NVarChar, categoryId)
            .input('name', sql.NVarChar, productName)
            .input('price', sql.Decimal, price)
            .input('num', sql.Int, numProduct)
            .input('img', sql.NVarChar, imageUrl)
            .input('detail', sql.NVarChar, detailProduct)
            .query(`
                INSERT INTO Product (category_id, product_name, price, num_product, image_url, detail_product)
                VALUES (@catId, @name, @price, @num, @img, @detail)
            `);

        res.json({ message: "Thêm sản phẩm thành công!", imageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    res.json({ message: "Đã đăng xuất an toàn" });
});

app.get('/api/admin/users', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT user_id, full_name, email, role_id, status FROM [User]');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật trạng thái (C14)
app.put('/api/admin/users/status', async (req, res) => {
    const { userId, status } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('status', sql.NVarChar, status)
            .query('UPDATE [User] SET status = @status WHERE user_id = @userId');
        res.json({ message: "Cập nhật trạng thái thành công" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật quyền hạn (C15)
app.put('/api/admin/users/role', async (req, res) => {
    const { userId, roleId } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('roleId', sql.NVarChar, roleId)
            .query('UPDATE [User] SET role_id = @roleId WHERE user_id = @userId');
        res.json({ message: "Cập nhật quyền thành công" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/user/update', async (req, res) => {
    try {
        const { userId, fullName, dob, sex } = req.body;
        let pool = await sql.connect(dbConfig);

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('fullName', sql.NVarChar, fullName)
            .input('dob', sql.Date, dob)
            .input('sex', sql.Char, sex)
            .query(`
                UPDATE [User] 
                SET full_name = @fullName, date_of_birth = @dob, sex = @sex 
                WHERE user_id = @userId
            `);

        res.json({ message: "Cập nhật thành công!", fullName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Xóa sản phẩm (C10)
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const productId = req.params.id;

        // 1. Kiểm tra xem sản phẩm có đang trong chiến dịch quảng cáo không
        const ppcCheck = await pool.request()
            .input('id', sql.Int, productId)
            .query('SELECT campaign_id FROM PCC_Campaign WHERE product_id = @id');

        if (ppcCheck.recordset.length > 0) {
            return res.status(400).json({
                error: "Không thể xóa! Sản phẩm này đang được sử dụng trong một chiến dịch quảng cáo PPC. Vui lòng xóa quảng cáo trước."
            });
        }

        // 2. Kiểm tra xem sản phẩm đã có đơn hàng chưa
        const orderCheck = await pool.request()
            .input('id', sql.Int, productId)
            .query('SELECT order_id FROM Order_Item WHERE product_id = @id');

        if (orderCheck.recordset.length > 0) {
            return res.status(400).json({
                error: "Không thể xóa vĩnh viễn! Sản phẩm này đã có lịch sử giao dịch. Hãy cập nhật số lượng về 0 thay vì xóa."
            });
        }

        // 3. Nếu không vướng ràng buộc nào, thực hiện xóa
        await pool.request()
            .input('id', sql.Int, productId)
            .query('DELETE FROM Product WHERE product_id = @id');

        res.json({ message: "Đã xóa sản phẩm thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống khi xóa: " + err.message });
    }
});

// Sửa thông tin sản phẩm (C10)
app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
    try {
        const { productName, price, numProduct, detailProduct, categoryId } = req.body;
        const productId = req.params.id;
        let imageUrl = req.body.imageUrl; // Giữ lại ảnh cũ nếu không up ảnh mới

        if (req.file) {
            imageUrl = req.file.path; // Lấy link ảnh mới từ Cloudinary nếu có
        }

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, productId)
            .input('catId', sql.NVarChar, categoryId)
            .input('name', sql.NVarChar, productName)
            .input('price', sql.Decimal, price)
            .input('num', sql.Int, numProduct)
            .input('img', sql.NVarChar, imageUrl)
            .input('detail', sql.NVarChar, detailProduct)
            .query(`
                UPDATE Product 
                SET product_name = @name, 
                    price = @price, 
                    num_product = @num, 
                    image_url = @img, 
                    detail_product = @detail,
                    category_id = @catId
                WHERE product_id = @id
            `);

        res.json({ message: "Cập nhật sản phẩm thành công!", imageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Product WHERE product_id = @id');
        res.json({ message: "Đã xóa sản phẩm thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sửa thông tin sản phẩm
app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        const { productName, price, numProduct, detailProduct, categoryId } = req.body;

        // Logic xử lý ảnh: Nếu có file mới thì lấy path Cloudinary, nếu không giữ ảnh cũ gửi từ body
        let imageUrl = req.body.imageUrl;
        if (req.file) {
            imageUrl = req.file.path;
        }

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, productId)
            .input('catId', sql.NVarChar, categoryId)
            .input('name', sql.NVarChar, productName)
            .input('price', sql.Decimal, price)
            .input('num', sql.Int, numProduct)
            .input('img', sql.NVarChar, imageUrl)
            .input('detail', sql.NVarChar, detailProduct)
            .query(`
                UPDATE Product 
                SET product_name = @name, 
                    price = @price, 
                    num_product = @num, 
                    image_url = @img, 
                    detail_product = @detail,
                    category_id = @catId
                WHERE product_id = @id
            `);

        res.json({ message: "Cập nhật thành công!", imageUrl });
    } catch (err) {
        console.error("Lỗi Backend:", err.message);
        res.status(500).json({ error: "Lỗi máy chủ khi cập nhật sản phẩm" });
    }
});

app.post('/api/feedback', async (req, res) => {
    try {
        const { userId, productId, content, rating } = req.body;

        // Kiểm tra điều kiện Alternative Flow: Đánh giá phải từ 3 từ trở lên
        const wordCount = content.trim().split(/\s+/).length;
        if (wordCount < 3) {
            return res.status(400).json({ error: "Vui lòng nhập thêm đánh giá (tối thiểu 3 từ)!" });
        }

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('uid', sql.Int, userId)
            .input('pid', sql.Int, productId)
            .input('content', sql.NVarChar, content)
            .input('rating', sql.Decimal(2, 1), rating)
            .query(`
                INSERT INTO Feedback (user_id, product_id, content, rating, feedback_date)
                VALUES (@uid, @pid, @content, @rating, GETDATE())
            `);

        res.json({ message: "Gửi đánh giá thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { userId, productId, quantity, totalPrice } = req.body;
        let pool = await sql.connect(dbConfig);

        // 1. Tạo đơn hàng mới
        const orderRes = await pool.request()
            .input('uid', sql.Int, userId)
            .input('total', sql.Decimal, totalPrice)
            .query(`INSERT INTO [Order] (user_id, order_date, status_order, total_price, prods_per_order) 
                    OUTPUT INSERTED.order_id VALUES (@uid, GETDATE(), N'Chờ xác nhận', @total, 1)`);

        const orderId = orderRes.recordset[0].order_id;

        // 2. Thêm vào chi tiết đơn hàng
        await pool.request()
            .input('oid', sql.Int, orderId)
            .input('pid', sql.Int, productId)
            .input('qty', sql.Int, quantity)
            .query(`INSERT INTO Order_Item (order_id, product_id, num_per_prod) VALUES (@oid, @pid, @qty)`);

        // 3. Trừ số lượng trong kho
        await pool.request()
            .input('pid', sql.Int, productId)
            .input('qty', sql.Int, quantity)
            .query(`UPDATE Product SET num_product = num_product - @qty WHERE product_id = @pid`);

        const cpRes = await pool.request()
            .input('pid', sql.Int, productId)
            .query("SELECT * FROM PCC_Campaign WHERE product_id = @pid AND status = 'Active'");

        if (cpRes.recordset.length > 0) {
            const cp = cpRes.recordset[0];

            // 2. Tính toán dựa trên số lượng sản phẩm thực tế khách mua (quantity)
            const newTotalClicks = cp.num_of_clicks + parseInt(quantity);
            const currentSpent = newTotalClicks * cp.cost_per_click;

            if (currentSpent >= cp.budget) {
                // HẾT NGÂN SÁCH: Đóng chiến dịch & Hoàn lại giá gốc
                await pool.request()
                    .input('cid', sql.Int, cp.campaign_id)
                    .input('newClicks', sql.Int, newTotalClicks)
                    .query("UPDATE PCC_Campaign SET status = 'Ended', num_of_clicks = @newClicks WHERE campaign_id = @cid");

                await pool.request()
                    .input('pid', sql.Int, productId)
                    .input('cpc', sql.Decimal, cp.cost_per_click)
                    .query("UPDATE Product SET price = price + @cpc WHERE product_id = @pid");
            } else {
                // CÒN NGÂN SÁCH: Chỉ cập nhật số lượng đã bán vào num_of_clicks
                await pool.request()
                    .input('cid', sql.Int, cp.campaign_id)
                    .input('newClicks', sql.Int, newTotalClicks)
                    .query("UPDATE PCC_Campaign SET num_of_clicks = @newClicks WHERE campaign_id = @cid");
            }
        }
        res.json({ message: "Đặt hàng thành công! 🐾" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thêm vào trong ProductDetail component
const handleOrder = async () => {
    if (!user) {
        alert("Quý khách vui lòng đăng nhập để đặt hàng nhé!");
        return;
    }
    try {
        await axios.post('http://localhost:5000/api/orders', {
            userId: user.user_id,
            productId: product.product_id,
            quantity: quantity,
            totalPrice: product.price
        });
        await pool.request()
            .input('pid', sql.Int, productId)
            .input('qty', sql.Int, quantity)
            .query('UPDATE Product SET num_product = num_product - @qty WHERE product_id = @pid');
        alert("Đặt hàng thành công!");
        onBack();
    } catch (err) { alert("Lỗi khi đặt hàng!"); }
};

// Lấy danh sách tất cả đơn hàng cho nhân viên
app.get('/api/admin/orders', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT o.order_id, o.order_date, o.total_price, o.status_order, 
                   u.full_name, p.product_name, oi.num_per_prod
            FROM [Order] o
            JOIN [User] u ON o.user_id = u.user_id
            JOIN Order_Item oi ON o.order_id = oi.order_id
            JOIN Product p ON oi.product_id = p.product_id
            ORDER BY o.order_date DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật trạng thái đơn hàng (C13)
app.put('/api/admin/orders/status', async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, orderId)
            .input('status', sql.NVarChar, newStatus)
            .query('UPDATE [Order] SET status_order = @status WHERE order_id = @id');
        res.json({ message: "Cập nhật trạng thái thành công" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Lấy lịch sử đơn hàng của 1 khách hàng (C08)
app.get('/api/orders/user/:userId', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('userId', sql.Int, req.params.userId)
            .query(`
                SELECT 
                    o.order_id, 
                    o.order_date, 
                    o.total_price, 
                    o.status_order, 
                    oi.num_per_prod, 
                    p.product_name, 
                    p.product_id 
                FROM [Order] o
                JOIN Order_Item oi ON o.order_id = oi.order_id
                JOIN Product p ON oi.product_id = p.product_id
                WHERE o.user_id = @userId
                ORDER BY o.order_date DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/chat/guest/clear', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .query('DELETE FROM Chat_History WHERE user_id IS NULL');
        res.json({ message: "Đã dọn dẹp lịch sử Guest" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        let pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM [User] WHERE email = @email');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ error: "Người dùng không tồn tại" });

        // KIỂM TRA STATUS: Nếu bị khóa (Inactive hoặc NULL) thì chặn ngay
        if (user.status !== 'Active') {
            return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Sai mật khẩu" });

        const token = jwt.sign({ id: user.user_id, role: user.role_id }, 'SECRET_KEY', { expiresIn: '1d' });

        res.json({
            token,
            role: user.role_id,
            fullName: user.full_name,
            user_id: user.user_id,
            dob: user.date_of_birth
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password, dob, sex } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10); // Mã hóa mật khẩu

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('roleId', sql.NVarChar, 'CUS') // Mặc định là khách hàng
            .input('fullName', sql.NVarChar, fullName)
            .input('email', sql.VarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .input('dob', sql.Date, dob)
            .input('sex', sql.Char, sex)
            .input('status', sql.NVarChar, 'Active')
            .query('INSERT INTO [User] (role_id, full_name, email, password, date_of_birth, sex, status) VALUES (@roleId, @fullName, @email, @password, @dob, @sex, @status)');

        res.json({ message: "Đăng ký thành công!" });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return res.status(400).json({ error: "Email này đã được sử dụng. Vui lòng chọn email khác!" });
        }

        console.error("LỖI CHI TIẾT:", err);
        res.status(500).json({ error: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau!" });
    }
});

app.get('/api/admin/ppc', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM PCC_Campaign ORDER BY campaign_id DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/ppc/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const campaignId = req.params.id;

        // 1. Lấy thông tin trạng thái và giá trị click của chiến dịch
        const checkCp = await pool.request()
            .input('cid', sql.Int, campaignId)
            .query("SELECT product_id, cost_per_click, status FROM PCC_Campaign WHERE campaign_id = @cid");

        if (checkCp.recordset.length > 0) {
            const { product_id, cost_per_click, status } = checkCp.recordset[0];

            // 2. CHỈ CỘNG LẠI GIÁ NẾU CHIẾN DỊCH ĐANG ACTIVE
            // Nếu status là 'Ended', nghĩa là giá đã được khôi phục khi hết ngân sách
            if (status === 'Active') {
                await pool.request()
                    .input('pid', sql.Int, product_id)
                    .input('cpc', sql.Decimal, cost_per_click)
                    .query("UPDATE Product SET price = price + @cpc WHERE product_id = @pid");
            }
        }

        // 3. Thực hiện xóa chiến dịch khỏi Database
        await pool.request()
            .input('cid', sql.Int, campaignId)
            .query("DELETE FROM PCC_Campaign WHERE campaign_id = @cid");

        res.json({ message: "Đã dọn dẹp chiến dịch thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/feedback/product/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('productId', sql.Int, req.params.id)
            .query(`
                SELECT f.content, f.rating, f.feedback_date, u.full_name
                FROM Feedback f
                JOIN [User] u ON f.user_id = u.user_id
                WHERE f.product_id = @productId
                ORDER BY f.feedback_date DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT category_id, category_name, category_icon FROM Category');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/categories', async (req, res) => {
    try {
        const { categoryId, categoryName, categoryIcon } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.NVarChar, categoryId)
            .input('name', sql.NVarChar, categoryName)
            .input('icon', sql.NVarChar, categoryIcon)
            // Thêm N trước giá trị icon để hỗ trợ Emoji
            .query('INSERT INTO Category (category_id, category_name, category_icon) VALUES (@id, @name, @icon)');
        res.json({ message: "Thêm thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Mã loại hàng đã tồn tại hoặc lỗi dữ liệu!" });
    }
});
app.put('/api/admin/categories/:id', async (req, res) => {
    try {
        const { categoryName, categoryIcon } = req.body;
        const catId = req.params.id;
        let pool = await sql.connect(dbConfig);

        await pool.request()
            .input('id', sql.NVarChar, catId)
            .input('name', sql.NVarChar, categoryName)
            .input('icon', sql.NVarChar, categoryIcon)
            .query(`
                UPDATE Category 
                SET category_name = @name, category_icon = @icon 
                WHERE category_id = @id
            `);

        res.json({ message: "Cập nhật danh mục thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/ppc', upload.single('banner'), async (req, res) => {
    try {
        const { creatorId, campaignName, budget, cpc, productId } = req.body;
        // Lấy link ảnh từ Cloudinary sau khi upload thành công
        const imageUrl = req.file ? req.file.path : null;

        let pool = await sql.connect(dbConfig);

        // 1. Lưu chiến dịch (Sửa imageUrl đúng với biến đã khai báo)
        await pool.request()
            .input('uid', sql.Int, creatorId)
            .input('pid', sql.Int, productId)
            .input('name', sql.NVarChar, campaignName)
            .input('budget', sql.Decimal(18, 2), budget)
            .input('cpc', sql.Decimal(18, 2), cpc)
            .input('banner', sql.NVarChar(sql.MAX), imageUrl) // Đã sửa từ banner thành imageUrl
            .query(`
                INSERT INTO PCC_Campaign (creator_id, product_id, campaign_name, budget, cost_per_click, banner_url, status, num_of_clicks)
                VALUES (@uid, @pid, @name, @budget, @cpc, @banner, 'Active', 0)
            `);

        // 2. Tự động giảm giá trực tiếp vào bảng Product
        await pool.request()
            .input('pid', sql.Int, productId)
            .input('discount', sql.Decimal(18, 2), cpc)
            .query('UPDATE Product SET price = price - @discount WHERE product_id = @pid');

        res.json({ message: "Kích hoạt quảng cáo và giảm giá thành công!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/ppc/:id', upload.single('banner'), async (req, res) => {
    try {
        const nNewCPC = Number(req.body.cost_per_click || 0);
        const { campaign_name, budget, status } = req.body;
        const campaignId = req.params.id;
        const nNewBudget = Number(budget);

        let pool = await sql.connect(dbConfig);

        // 1. Lấy dữ liệu hiện tại để kiểm tra
        const oldData = await pool.request()
            .input('cid', sql.Int, campaignId)
            .query(`SELECT status, p.product_id, p.price, ppc.cost_per_click, ppc.num_of_clicks 
                    FROM PCC_Campaign ppc 
                    JOIN Product p ON ppc.product_id = p.product_id 
                    WHERE ppc.campaign_id = @cid`);

        if (oldData.recordset.length > 0) {
            const {
                status: oldStatus,
                product_id,
                price: currentPrice,
                cost_per_click: oldCPC,
                num_of_clicks
            } = oldData.recordset[0];

            // TÍNH TOÁN SỐ TIỀN ĐÃ TIÊU
            const spent = num_of_clicks * oldCPC;

            // KIỂM TRA ĐIỀU KIỆN KHỞI ĐỘNG LẠI (ADMIN RESTART)
            if (oldStatus === 'Ended' && status === 'Active') {
                if (nNewBudget <= spent) {
                    return res.status(400).json({
                        error: `Không thể kích hoạt! Ngân sách (${nNewBudget.toLocaleString()}đ) phải lớn hơn số tiền đã tiêu (${spent.toLocaleString()}đ). Vui lòng tăng ngân sách!`
                    });
                }
            }

            // Logic tính toán lại giá sản phẩm (Giữ nguyên hoặc tối ưu)
            let nPrice = Number(currentPrice);
            let nOldCPC = Number(oldCPC);

            if (oldStatus === 'Active' && status === 'Ended') {
                nPrice = nPrice + nOldCPC; // Hoàn lại giá gốc
            } else if (oldStatus === 'Ended' && status === 'Active') {
                nPrice = nPrice - nNewCPC; // Trừ giá khuyến mãi mới
            } else if (oldStatus === 'Active' && status === 'Active' && nOldCPC !== nNewCPC) {
                nPrice = nPrice + nOldCPC - nNewCPC;
            }

            if (!isNaN(nPrice) && nPrice !== Number(currentPrice)) {
                await pool.request()
                    .input('pid', sql.Int, product_id)
                    .input('price', sql.Decimal(18, 2), nPrice)
                    .query("UPDATE Product SET price = @price WHERE product_id = @pid");
            }
        }

        // 2. Cập nhật thông tin chiến dịch vào Database
        let bannerUrl = req.body.banner_url;
        if (req.file) bannerUrl = req.file.path;

        await pool.request()
            .input('id', sql.Int, campaignId)
            .input('name', sql.NVarChar, campaign_name)
            .input('budget', sql.Decimal, nNewBudget)
            .input('status', sql.NVarChar, status)
            .input('cpc', sql.Decimal, nNewCPC)
            .input('url', sql.VarChar, bannerUrl)
            .query(`UPDATE PCC_Campaign SET campaign_name = @name, budget = @budget, 
                    status = @status, cost_per_click = @cpc, banner_url = @url 
                    WHERE campaign_id = @id`);

        res.json({ message: "Cập nhật và kích hoạt chiến dịch thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    }
});
app.get('/api/ppc/active', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        // Lấy tất cả các chiến dịch đang Active
        let result = await pool.request()
            .query("SELECT * FROM PCC_Campaign WHERE status = 'Active' ORDER BY campaign_id DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/cancel/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        let pool = await sql.connect(dbConfig);

        // 1. Lấy thông tin từ bảng Order_Item (nơi chứa số lượng thực tế)
        const orderInfo = await pool.request()
            .input('oid', sql.Int, orderId)
            .query(`
                SELECT oi.product_id, oi.num_per_prod, o.status_order 
                FROM [Order] o
                JOIN Order_Item oi ON o.order_id = oi.order_id
                WHERE o.order_id = @oid
            `);

        if (orderInfo.recordset.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy thông tin sản phẩm trong đơn hàng!" });
        }

        const order = orderInfo.recordset[0];

        // Kiểm tra trạng thái: Chỉ cho hủy nếu đang "Chờ xác nhận" hoặc tương đương
        if (order.status_order === 'Đã hủy' || order.status_order === 'Giao hàng thành công') {
            return res.status(400).json({ error: "Đơn hàng này đã kết thúc, không thể hủy!" });
        }

        // 2. Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // Cập nhật trạng thái đơn hàng thành 'Đã hủy'
            await transaction.request()
                .input('oid', sql.Int, orderId)
                .query("UPDATE [Order] SET status_order = N'Đã hủy' WHERE order_id = @oid");

            // Cộng lại số lượng sản phẩm vào kho (num_per_prod lấy từ Order_Item)
            await transaction.request()
                .input('pid', sql.Int, order.product_id)
                .input('qty', sql.Int, order.num_per_prod)
                .query("UPDATE Product SET num_product = num_product + @qty WHERE product_id = @pid");

            await transaction.commit();
            res.json({ message: "Hủy đơn hàng thành công và đã hoàn kho!" });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: "Lỗi: " + err.message });
    }
});

// API: Xóa danh mục (Lưu ý: Chỉ xóa được nếu không có sản phẩm nào thuộc loại này)
app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.NVarChar, req.params.id)
            .query('DELETE FROM Category WHERE category_id = @id');
        res.json({ message: "Đã xóa loại hàng thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Không thể xóa loại hàng đang có sản phẩm kinh doanh!" });
    }
});

// Lấy toàn bộ sản phẩm (C04)
app.get('/api/products', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                p.*, 
                COUNT(f.feedback_id) AS total_feedback,
                AVG(f.rating) AS avg_rating,
                ISNULL(ppc.cost_per_click, 0) as discount_amount -- Thêm dòng này
            FROM Product p
            LEFT JOIN Feedback f ON p.product_id = f.product_id
            LEFT JOIN PCC_Campaign ppc ON p.product_id = ppc.product_id AND ppc.status = 'Active' -- Thêm dòng này
            GROUP BY 
                p.product_id, p.category_id, p.product_name, 
                p.price, p.num_product, p.image_url, p.detail_product,
                ppc.cost_per_click -- Thêm vào group by
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lấy chi tiết sản phẩm (C05)
app.get('/api/products/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT p.*, 
                       ppc.cost_per_click as discount_amount,
                       ppc.budget,
                       ppc.num_of_clicks,
                       ppc.status as ppc_status,
                       -- Tính số lượng tối đa có thể giảm giá dựa trên ngân sách còn lại
                       CASE 
                         WHEN ppc.status = 'Active' THEN 
                            FLOOR((ppc.budget - (ppc.num_of_clicks * ppc.cost_per_click)) / ppc.cost_per_click)
                         ELSE 0 
                       END as max_discount_qty
                FROM Product p
                LEFT JOIN PCC_Campaign ppc ON p.product_id = ppc.product_id AND ppc.status = 'Active'
                WHERE p.product_id = @id
            `);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reports/:month/:year', async (req, res) => {
    try {
        const { month, year } = req.params;
        let pool = await sql.connect(dbConfig);

        // 1. Thống kê doanh thu và số đơn hàng theo ngày trong tháng
        const revenueRes = await pool.request()
            .input('m', sql.Int, month)
            .input('y', sql.Int, year)
            .query(`
                SELECT DAY(order_date) as day, SUM(total_price) as dailyRevenue, COUNT(order_id) as orderCount
                FROM [Order]
                WHERE MONTH(order_date) = @m AND YEAR(order_date) = @y AND status_order != N'Đã hủy'
                GROUP BY DAY(order_date)
                ORDER BY day
            `);

        // 2. Thống kê hiệu quả quảng cáo PPC (Chi phí và lượt mua)
        const ppcRes = await pool.request()
            .query(`
                SELECT campaign_name, budget, (num_of_clicks * cost_per_click) as spent, num_of_clicks as conversions
                FROM PCC_Campaign
            `);

        res.json({
            dailyStats: revenueRes.recordset,
            ppcStats: ppcRes.recordset,
            totalRevenue: revenueRes.recordset.reduce((sum, item) => sum + item.dailyRevenue, 0),
            totalOrders: revenueRes.recordset.reduce((sum, item) => sum + item.orderCount, 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route cho Chatbot Gemini
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userId, role, messageCount } = req.body;
        const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
        let pool = await sql.connect(dbConfig);

        if (!userId && messageCount >= 1) {
            return res.status(403).json({
                reply: "Bạn chỉ được hỏi 1 câu với tư cách khách. Vui lòng đăng nhập để tiếp tục trò chuyện!"
            });
        }
        if (role !== 'ADM') {
            const checkLimit = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT dbo.fn_GetTodayChatCount(@userId) AS todayCount');

            const todayCount = checkLimit.recordset[0].todayCount;

            if (todayCount >= 15) {
                return res.status(403).json({
                    reply: "Chủ nhân ơi, hôm nay bạn đã hỏi Fellua 15 câu rồi. Hãy nghỉ ngơi và quay lại vào ngày mai nhé! 🐾"
                });
            }
        }

        const prompt = `Bạn là trợ lý ảo của Pet Shop Fellua. Hãy trả lời thân thiện về thú cưng. Câu hỏi: ${message}`;
        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const response = result.text; 

        // Phần lưu database giữ nguyên như cũ
        await pool.request()
            .input('userId', sql.Int, userId || null)
            .input('question', sql.NVarChar(sql.MAX), message)
            .input('answer', sql.NVarChar(sql.MAX), response)
            .query('INSERT INTO [Chat_history] (user_id, question, answer, chat_time) VALUES (@userId, @question, @answer, GETDATE())');

        res.json({ reply: response });
    } catch (err) {
        console.error(err); // In lỗi ra terminal để dễ kiểm tra
        res.status(500).json({ error: err.message });
    }
});

app.listen(5000, () => console.log('Server chạy tại port 5000')); 
