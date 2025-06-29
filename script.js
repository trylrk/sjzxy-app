if (!localStorage.getItem("user") && window.location.pathname.includes("messages.html")) {
    window.location.href = "login.html";
}

const user = JSON.parse(localStorage.getItem("user")) || {};
let replyingTo = null;
let lastPostId = 0;
let existingPostIds = new Set();
let selectedImages = [];
let refreshInterval; // 用于管理刷新定时器

// 启动刷新
function startRefresh() {
    if (!refreshInterval) {
        refreshInterval = setInterval(() => loadPosts(), 2000);
        console.log("启动帖子刷新");
    }
}

// 停止刷新
function stopRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log("停止帖子刷新");
    }
}

// 为输入框添加聚焦和失焦事件监听
function setupInputListeners() {
    const inputs = document.querySelectorAll('.post-input, .comment-input, .reply-input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            stopRefresh();
            console.log("输入框聚焦，停止刷新");
        });
        input.addEventListener('blur', () => {
            startRefresh();
            console.log("输入框失焦，恢复刷新");
        });
    });
}

function login(event) {
    event.preventDefault();
    const studentId = document.getElementById("studentId").value.trim();
    const studentName = document.getElementById("studentName").value.trim();

    if (!studentId || !studentName) {
        alert("请填写完整信息！");
        return;
    }

    fetch("http://114.55.131.232:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, studentName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem("user", JSON.stringify({ studentId, studentName }));
            window.location.href = "messages.html";
        } else {
            alert("学号或姓名错误！");
        }
    })
    .catch(err => {
        console.error("登录失败:", err);
        alert("登录出错，请稍后再试！");
    });
}

function handleImageSelect() {
    const files = document.getElementById("imageInput").files;
    if (files.length > 6) {
        alert("最多只能上传六张图片！");
        document.getElementById("imageInput").value = "";
        selectedImages = [];
        return;
    }
    selectedImages = Array.from(files);
    updateImagePreview();
}

function updateImagePreview() {
    const preview = document.getElementById("imagePreview");
    preview.innerHTML = "";
    selectedImages.forEach((image, index) => {
        const div = document.createElement("div");
        const img = document.createElement("img");
        img.src = URL.createObjectURL(image);
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.onclick = () => {
            selectedImages.splice(index, 1);
            URL.revokeObjectURL(img.src);
            updateImagePreview();
        };
        div.appendChild(img);
        div.appendChild(removeBtn);
        preview.appendChild(div);
    });
}

function submitPost() {
    const content = document.getElementById("postContent").value.trim();
    if (!content && selectedImages.length === 0) {
        alert("请至少输入文字或选择图片！");
        return;
    }

    const formData = new FormData();
    formData.append("studentId", user.studentId);
    formData.append("studentName", user.studentName);
    formData.append("content", content);
    formData.append("timestamp", new Date().toISOString());

    selectedImages.forEach((image) => {
        formData.append("images", image);
    });

    console.log("发送帖子请求...");
    fetch("http://114.55.131.232:3000/api/post", {
        method: "POST",
        body: formData
    })
    .then(response => {
        console.log("收到响应:", response);
        if (!response.ok) throw new Error("发布失败，状态码: " + response.status);
        return response.json();
    })
    .then(post => {
        console.log("帖子数据:", post);
        document.getElementById("postContent").value = "";
        document.getElementById("imageInput").value = "";
        selectedImages.forEach(image => URL.revokeObjectURL(image));
        selectedImages = [];
        document.getElementById("imagePreview").innerHTML = "";
        addPostToTop(post);
    })
    .catch(err => {
        console.error("发帖失败:", err);
        alert("发布失败，请稍后再试！");
    });
}

function addPostToTop(post) {
    const container = document.getElementById("postsContainer");
    if (!container || existingPostIds.has(post.id)) return;

    const div = document.createElement("div");
    div.className = "post";
    div.dataset.id = post.id;
    div.innerHTML = `
        <div class="avatar" style="background: ${getAvatarColor(post.studentId)}"></div>
        <div class="post-content">
            <strong>${post.studentId === user.studentId ? "我" : post.studentName}</strong><br>
            <p>${post.content}</p>
            ${post.images && post.images.length > 0 ? `
                <div class="post-images">
                    ${post.images.map(img => `<img src="http://114.55.131.232:3000${img}" alt="Post Image" onclick="showImageModal('http://114.55.131.232:3000${img}')">`).join("")}
                </div>
            ` : ""}
            <small>${new Date(post.timestamp).toLocaleString()}</small>
            <div class="actions">
            
                <input type="text" placeholder="评论" class="comment-input" id="comment-${post.id}" onkeydown="if(event.key === 'Enter') submitComment('${post.id}')">
                <button class="comment-btn" onclick="submitComment('${post.id}')">发送</button>
            </div>
            <div class="comments" id="comments-${post.id}">${renderComments(post.comments, post.studentId)}</div>
        </div>
    `;
    container.insertBefore(div, container.firstChild);
    existingPostIds.add(post.id);
    lastPostId = Math.max(lastPostId, post.id);
    console.log("新帖子已插入顶部:", post);
    setupInputListeners(); // 为新生成的输入框绑定事件
}

function loadPosts() {
    fetch("http://114.55.131.232:3000/api/posts")
    .then(response => response.json())
    .then(posts => {
        const container = document.getElementById("postsContainer");
        if (!container) return;
        document.getElementById("userName").textContent = user.studentName;
        posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log("排序后的帖子:", posts);

        const activeElement = document.activeElement;
        const activePostId = activeElement && activeElement.id && activeElement.id.startsWith("comment-") ? activeElement.id.split("-")[1] : null;
        const activeValue = activeElement && activeElement.value ? activeElement.value : "";

        container.innerHTML = "";
        existingPostIds.clear();
        posts.forEach(post => {
            const div = document.createElement("div");
            div.className = "post";
            div.dataset.id = post.id;
            div.innerHTML = `
                <div class="avatar" style="background: ${getAvatarColor(post.studentId)}"></div>
                <div class="post-content">
                    <strong>${post.studentId === user.studentId ? "我" : post.studentName}</strong><br>
                    <p>${post.content}</p>
                    ${post.images && post.images.length > 0 ? `
                        <div class="post-images">
                            ${post.images.map(img => `<img src="http://114.55.131.232:3000${img}" alt="Post Image" onclick="showImageModal('http://114.55.131.232:3000${img}')">`).join("")}
                        </div>
                    ` : ""}
                    <small>${new Date(post.timestamp).toLocaleString()}</small>
                    <div class="actions">
                        
                        <input type="text" placeholder="评论" class="comment-input" id="comment-${post.id}" onkeydown="if(event.key === 'Enter') submitComment('${post.id}')">
                        <button class="comment-btn" onclick="submitComment('${post.id}')">发送</button>
                    </div>
                    <div class="comments" id="comments-${post.id}">${renderComments(post.comments, post.studentId)}</div>
                </div>
            `;
            container.appendChild(div);
            existingPostIds.add(post.id);
            lastPostId = Math.max(lastPostId, post.id);
        });

        if (activePostId) {
            const input = document.getElementById(`comment-${postId}`);
            if (input) {
                input.value = activeValue;
                input.focus();
            }
        }

        console.log("帖子列表已渲染:", posts);
        setupInputListeners(); // 为动态生成的输入框绑定事件
        checkNotifications();
    })
    .catch(err => console.error("加载帖子失败:", err));
}

function submitComment(postId) {
    const comment = document.getElementById(`comment-${postId}`).value.trim();
    if (!comment) return;

    const commentDiv = document.getElementById(`comments-${postId}`);
    const newComment = document.createElement("p");
    newComment.className = "self-comment";
    newComment.textContent = `我: ${comment}`;
    commentDiv.appendChild(newComment);

    fetch("http://114.55.131.232:3000/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            postId,
            studentId: user.studentId,
            studentName: user.studentName,
            comment,
            timestamp: new Date().toISOString(),
            read: false
        })
    })
    .then(() => {
        document.getElementById(`comment-${postId}`).value = "";
        loadPosts();
        checkNotifications();
    })
    .catch(err => console.error("评论失败:", err));
}

function renderComments(comments, postOwnerId) {
    return comments ? comments.map(c => `
        <p class="${c.studentId === postOwnerId ? 'self-comment' : ''}">
            ${c.studentId === user.studentId ? "我" : c.studentName}: ${c.comment}
        </p>`).join("") : "";
}

function sendPrivateMessage(receiverId, receiverName) {
    const content = prompt(`给 ${receiverName} (${receiverId}) 发送私信:`);
    if (!content) return;

    fetch("http://114.55.131.232:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            senderId: user.studentId,
            senderName: user.studentName,
            receiverId,
            receiverName,
            content,
            timestamp: new Date().toISOString(),
            read: false
        })
    })
    .then(() => {
        alert("私信已发送！");
        checkNotifications();
    })
    .catch(err => console.error("私信发送失败:", err));
}

function checkNotifications() {
    Promise.all([
        fetch("http://114.55.131.232:3000/api/posts").then(res => res.json()),
        fetch(`http://114.55.131.232:3000/api/chat?userId=${user.studentId}`).then(res => res.json())
    ])
    .then(([posts, chats]) => {
        console.log("检查通知 - Posts:", posts);
        console.log("检查通知 - Chats:", chats);

        const myPosts = posts.filter(p => p.studentId === user.studentId);
        const hasUnreadCommentsOnMyPosts = myPosts.some(p => p.comments && p.comments.some(c => c.studentId !== user.studentId && !c.read));

        const hasUnreadRepliesToMyComments = posts.some(p => 
            p.studentId !== user.studentId && 
            p.comments && p.comments.some(c => 
                c.studentId !== user.studentId && 
                !c.read && 
                c.comment.includes(`回复 ${user.studentId}`)
            )
        );

        const hasUnreadChats = chats.some(chat => chat.receiverId === user.studentId && !chat.read);

        console.log("未读评论（我的帖子）:", hasUnreadCommentsOnMyPosts);
        console.log("未读回复（别人回复我的评论）:", hasUnreadRepliesToMyComments);
        console.log("未读私信:", hasUnreadChats);

        const dot = document.getElementById("notificationDot");
        if (dot) {
            dot.style.display = (hasUnreadCommentsOnMyPosts || hasUnreadRepliesToMyComments || hasUnreadChats) ? "block" : "none";
        } else {
            console.error("红点元素未找到");
        }
    })
    .catch(err => console.error("检查通知失败:", err));
}

function showMyMessages() {
    Promise.all([
        fetch("http://114.55.131.232:3000/api/posts").then(res => res.json()),
        fetch(`http://114.55.131.232:3000/api/chat?userId=${user.studentId}`).then(res => res.json())
    ])
    .then(([posts, chats]) => {
        console.log("显示消息 - Posts:", posts);
        console.log("显示消息 - Chats:", chats);
        const myPosts = posts.filter(p => p.studentId === user.studentId);
        const myChats = chats.filter(chat => chat.senderId === user.studentId || chat.receiverId === user.studentId);
        const container = document.getElementById("myMessagesContainer");
        container.innerHTML = "";

        container.innerHTML += "<h3>评论</h3>";
        myPosts.forEach(post => {
            if (post.comments && post.comments.length > 0) {
                const div = document.createElement("div");
                div.innerHTML = `
                    <p><strong>你的帖子:</strong> ${post.content}</p>
                    ${post.images && post.images.length > 0 ? `
                        <div class="post-images">
                            ${post.images.map(img => `<img src="http://114.55.131.232:3000${img}" alt="Post Image">`).join("")}
                        </div>
                    ` : ""}
                    ${post.comments.map(c => `
                        <p>${c.studentId === user.studentId ? "我" : c.studentName}: ${c.comment}
                        <button class="reply-btn" onclick="setReply('${post.id}', '${c.studentId}')">回复</button></p>
                    `).join("")}
                `;
                container.appendChild(div);
            }
        });

        container.innerHTML += "<h3>私信</h3>";
        myChats.forEach(chat => {
            const div = document.createElement("div");
            div.innerHTML = `
                <p>${chat.senderId === user.studentId ? "你" : chat.senderName}: ${chat.content}</p>
                ${chat.senderId !== user.studentId ? `<button class="reply-btn" onclick="setPrivateReply('${chat.senderId}', '${chat.senderName}')">回复</button>` : ""}
            `;
            container.appendChild(div);
        });

        document.getElementById("myMessagesModal").style.display = "block";
        fetch("http://114.55.131.232:3000/api/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: user.studentId })
        })
        .then(() => fetch("http://114.55.131.232:3000/api/mark-chat-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receiverId: user.studentId })
        }))
        .then(() => checkNotifications());
    })
    .catch(err => console.error("加载消息失败:", err));
}

function hideMyMessages() {
    document.getElementById("myMessagesModal").style.display = "none";
    replyingTo = null;
    document.getElementById("replyContent").value = "";
    checkNotifications();
}

function showImageModal(src) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("enlargedImage");
    img.src = src;
    modal.style.display = "block";
}

function hideImageModal() {
    document.getElementById("imageModal").style.display = "none";
}

function setReply(postId, commenterId) {
    replyingTo = { type: "comment", postId, commenterId };
    document.getElementById("replyContent").placeholder = `回复 ${commenterId}...`;
    document.getElementById("replyContent").focus();
}

function setPrivateReply(senderId, senderName) {
    replyingTo = { type: "chat", receiverId: senderId, receiverName: senderName };
    document.getElementById("replyContent").placeholder = `回复 ${senderName}...`;
    document.getElementById("replyContent").focus();
}

function submitReply() {
    if (!replyingTo) return;
    const content = document.getElementById("replyContent").value.trim();
    if (!content) return;

    if (replyingTo.type === "comment") {
        fetch("http://114.55.131.232:3000/api/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                postId: replyingTo.postId,
                studentId: user.studentId,
                studentName: user.studentName,
                comment: `回复 ${replyingTo.commenterId}: ${content}`,
                timestamp: new Date().toISOString(),
                read: false
            })
        })
        .then(() => {
            document.getElementById("replyContent").value = "";
            showMyMessages();
            loadPosts();
        })
        .catch(err => console.error("回复失败:", err));
    } else if (replyingTo.type === "chat") {
        fetch("http://114.55.131.232:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                senderId: user.studentId,
                senderName: user.studentName,
                receiverId: replyingTo.receiverId,
                receiverName: replyingTo.receiverName,
                content,
                timestamp: new Date().toISOString(),
                read: false
            })
        })
        .then(() => {
            document.getElementById("replyContent").value = "";
            showMyMessages();
            checkNotifications();
        })
        .catch(err => console.error("私信回复失败:", err));
    }
}

function getAvatarColor(studentId) {
    const colors = ["#1DA1F2", "#ff4444", "#00cc00", "#ffbb00"];
    const index = parseInt(studentId.slice(-1)) % colors.length;
    return colors[index];
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// if (window.location.pathname.includes("messages.html")) {
//     loadPosts();
//     checkNotifications();
//     startRefresh(); // 初始化时启动刷新
//     setupInputListeners(); // 初始化时绑定输入框事件
// }
if (window.location.pathname.includes("messages.html")) {
        loadPosts();
        checkNotifications();
        startRefresh(); // 初始化时启动刷新
        setupInputListeners(); // 初始化时绑定输入框事件
    }