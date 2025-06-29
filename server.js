const express = require("express");
const multer = require("multer");
const path = require('path'); // 新增 path 模块
const app = express();

app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST");
    next();
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage }).array("images", 6);

let posts = [];
let chats = [];

app.get("/api/posts", (req, res) => res.json(posts));

app.post("/api/post", upload, (req, res) => {
    const post = {
        studentId: req.body.studentId,
        studentName: req.body.studentName,
        content: req.body.content,
        timestamp: req.body.timestamp,
        id: posts.length + 1,
        comments: [],
        images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
    };
    posts.push(post);
    res.json(post);
});

app.post("/api/comment", (req, res) => {
    const { postId, studentId, studentName, comment, timestamp, read } = req.body;
    const post = posts.find(p => p.id == postId);
    if (post) {
        post.comments.push({ studentId, studentName, comment, timestamp, read });
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.post("/api/login", (req, res) => {
    const { studentId, studentName } = req.body;
    const validStudents = [
        { studentId: "123456", studentName: "用户" },
        // { studentId: "2023002", studentName: "李四" },
        // { studentId: "2023003", studentName: "王五" },
        // { studentId: "2023003", studentName: "王五" },
        { studentId: "2025666", studentName: "管理员" }
    ];
    if (validStudents.some(s => s.studentId === studentId && s.studentName === studentName)) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post("/api/mark-read", (req, res) => {
    const { studentId } = req.body;
    posts.forEach(post => {
        if (post.studentId === studentId && post.comments) {
            post.comments.forEach(comment => {
                comment.read = true;
            });
        }
    });
    res.sendStatus(200);
});

app.post("/api/chat", (req, res) => {
    const message = req.body;
    chats.push(message);
    res.sendStatus(200);
});

app.get("/api/chat", (req, res) => {
    const { userId } = req.query;
    const messages = chats.filter(msg =>
        msg.senderId === userId || msg.receiverId === userId
    );
    res.json(messages);
});

app.post("/api/mark-chat-read", (req, res) => {
    const { receiverId } = req.body;
    chats.forEach(chat => {
        if (chat.receiverId === receiverId) chat.read = true;
    });
    res.sendStatus(200);
});

// 静态文件服务：服务所有 HTML、CSS、JS 文件
app.use(express.static(path.join(__dirname, '.')));

// 根路径重定向到 login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.use("/uploads", express.static("uploads"));

app.listen(3000, () => console.log("Server running on port 3000"));