/**
 * Marketpalace — front-end marketplace (demo)
 * Data lives in localStorage only; not suitable for production secrets or payments.
 */
(function () {
    var USERS_KEY = "mp_users_v1";
    var SESSION_KEY = "mp_session_v1";
    var PRODUCTS_KEY = "mp_products_v1";
    var ORDERS_KEY = "mp_orders_v1";
    var CART_KEY = "mp_cart_v1";
    var STORAGE_SEEDED = "mp_seeded_demo_v1";

    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw);
        } catch (_e) {
            return fallback;
        }
    }

    function writeJson(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }

    function uid(prefix) {
        return (prefix || "id") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    }

    function escapeHtml(str) {
        var d = document.createElement("div");
        d.textContent = str == null ? "" : String(str);
        return d.innerHTML;
    }

    function formatMoney(n) {
        var num = typeof n === "number" ? n : parseFloat(n);
        if (isNaN(num)) num = 0;
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
    }

    function getUsers() {
        return readJson(USERS_KEY, []);
    }

    function saveUsers(users) {
        writeJson(USERS_KEY, users);
    }

    function getProducts() {
        return readJson(PRODUCTS_KEY, []);
    }

    function saveProducts(products) {
        writeJson(PRODUCTS_KEY, products);
    }

    function seedDemoProducts() {
        if (localStorage.getItem(STORAGE_SEEDED)) return;
        var demo = [
            {
                id: uid("demo"),
                title: "UI Starter Kit — Dark",
                description: "Production-ready UI blocks, tokens, and layout patterns for dashboards.",
                price: 49,
                fileName: "ui-starter-kit.zip",
                fileSize: 2450000,
                creatorEmail: "studio@demo.marketpalace",
                createdAt: Date.now() - 86400000 * 5,
            },
            {
                id: uid("demo"),
                title: "Notion Freelance CRM",
                description: "Everything you need to run client work: intake, invoicing milestones, pipeline.",
                price: 19,
                fileName: "freelance-crm.notion",
                fileSize: 120000,
                creatorEmail: "studio@demo.marketpalace",
                createdAt: Date.now() - 86400000 * 2,
            },
            {
                id: uid("demo"),
                title: "Email Copy Pack — SaaS",
                description: "Onboarding sequences, churn saves, and launch emails.",
                price: 35,
                fileName: "saas-email-pack.pdf",
                fileSize: 890000,
                creatorEmail: "studio@demo.marketpalace",
                createdAt: Date.now() - 86400000,
            },
        ];
        saveProducts(demo.concat(getProducts()));
        localStorage.setItem(STORAGE_SEEDED, "1");
    }

    /** @returns {{ email:string, role:string }|null} */
    function getSession() {
        var s = readJson(SESSION_KEY, null);
        if (!s || !s.email) return null;
        return s;
    }

    function setSession(email, role, displayName) {
        writeJson(SESSION_KEY, { email: email, role: role, displayName: displayName });
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function findUser(email) {
        var users = getUsers();
        var e = (email || "").trim().toLowerCase();
        for (var i = 0; i < users.length; i++) {
            if (users[i].emailLower === e) return users[i];
        }
        return null;
    }

    function registerUser(email, password, displayName, isCreator) {
        var e = (email || "").trim();
        var dl = e.toLowerCase();
        if (!e || findUser(dl)) return { ok: false, error: "An account with this email already exists." };
        if (!password || String(password).length < 6) return { ok: false, error: "Password must be at least 6 characters." };

        var users = getUsers();
        users.push({
            email: e,
            emailLower: dl,
            password: String(password),
            displayName: (displayName || "").trim() || e.split("@")[0],
            role: isCreator ? "creator" : "buyer",
        });
        saveUsers(users);
        return { ok: true };
    }

    function loginUser(email, password) {
        var u = findUser(email);
        if (!u || u.password !== String(password)) return { ok: false, error: "Invalid email or password." };
        setSession(u.emailLower, u.role, u.displayName);
        return { ok: true, user: u };
    }

    function logoutUser() {
        clearSession();
    }

    function getCurrentProfile() {
        var sess = getSession();
        if (!sess) return null;
        var u = findUser(sess.email);
        if (!u) {
            clearSession();
            return null;
        }
        return { session: sess, user: u };
    }

    function isLoggedIn() {
        return getCurrentProfile() !== null;
    }

    /** @param {string} nextPage basename e.g. checkout.html */
    function requireLogin(nextPage) {
        if (isLoggedIn()) return true;
        var next = nextPage || "dashboard.html";
        window.location.href = "login.html?next=" + encodeURIComponent(next);
        return false;
    }

    function getCart() {
        return readJson(CART_KEY, []);
    }

    function setCart(lines) {
        writeJson(CART_KEY, lines);
    }

    function cartItemCount() {
        var cart = getCart();
        var n = 0;
        for (var i = 0; i < cart.length; i++) n += cart[i].qty || 0;
        return n;
    }

    function addToCart(productId) {
        var cart = getCart();
        var found = false;
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].productId === productId) {
                cart[i].qty = (cart[i].qty || 1) + 1;
                found = true;
                break;
            }
        }
        if (!found) cart.push({ productId: productId, qty: 1 });
        setCart(cart);
        refreshHeaderChrome();
    }

    function setLineQty(productId, qty) {
        var cart = getCart();
        var next = [];
        for (var i = 0; i < cart.length; i++) {
            var line = cart[i];
            if (line.productId !== productId) {
                next.push(line);
                continue;
            }
            if (qty > 0) next.push({ productId: productId, qty: qty });
        }
        setCart(next);
        refreshHeaderChrome();
    }

    function removeFromCart(productId) {
        setLineQty(productId, 0);
    }

    function clearCart() {
        setCart([]);
        refreshHeaderChrome();
    }

    function getCartWithProducts() {
        var products = getProducts();
        var byId = {};
        for (var i = 0; i < products.length; i++) byId[products[i].id] = products[i];

        var lines = getCart();
        var rows = [];
        var subtotal = 0;
        for (var j = 0; j < lines.length; j++) {
            var p = byId[lines[j].productId];
            var qty = lines[j].qty || 1;
            if (!p) continue;
            var lineTotal = Number(p.price) * qty;
            subtotal += lineTotal;
            rows.push({ line: lines[j], product: p, qty: qty, lineTotal: lineTotal });
        }
        return { rows: rows, subtotal: subtotal };
    }

    function getOrders() {
        return readJson(ORDERS_KEY, []);
    }

    function saveOrders(orders) {
        writeJson(ORDERS_KEY, orders);
    }

    function placeOrder() {
        var profile = getCurrentProfile();
        if (!profile) return { ok: false, error: "You must be signed in." };
        var pack = getCartWithProducts();
        if (pack.rows.length === 0) return { ok: false, error: "Your cart is empty." };

        var items = pack.rows.map(function (r) {
            return {
                productId: r.product.id,
                title: r.product.title,
                price: r.product.price,
                qty: r.qty,
            };
        });

        var order = {
            id: uid("ord"),
            buyerEmail: profile.user.emailLower,
            items: items,
            total: pack.subtotal,
            placedAt: Date.now(),
            status: "paid",
            note: "Demo checkout — no real payment processed.",
        };

        var orders = getOrders();
        orders.unshift(order);
        saveOrders(orders);
        clearCart();
        return { ok: true, order: order };
    }

    function addProductFromForm(fields) {
        var profile = getCurrentProfile();
        if (!profile || profile.user.role !== "creator") {
            return { ok: false, error: "Only creator accounts can list products." };
        }
        var title = (fields.title || "").trim();
        var description = (fields.description || "").trim();
        var price = parseFloat(fields.price);
        var fileInput = fields.fileInput;
        var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

        if (!title) return { ok: false, error: "Title is required." };
        if (!description) return { ok: false, error: "Description is required." };
        if (isNaN(price) || price < 0) return { ok: false, error: "Enter a valid price." };

        var product = {
            id: uid("p"),
            title: title,
            description: description,
            price: Math.round(price * 100) / 100,
            fileName: file ? file.name : "Digital asset",
            fileSize: file ? file.size : 0,
            creatorEmail: profile.user.emailLower,
            createdAt: Date.now(),
        };

        var list = getProducts();
        list.unshift(product);
        saveProducts(list);
        return { ok: true, product: product };
    }

    /** Mount auth links into #auth-links or [data-mp-auth] */
    function refreshHeaderChrome() {
        var count = cartItemCount();
        var badges = document.querySelectorAll("[data-mp-cart-count]");
        for (var b = 0; b < badges.length; b++) {
            badges[b].textContent = String(count);
            badges[b].setAttribute("data-empty", count === 0 ? "1" : "0");
        }

        var slot = document.getElementById("auth-links");
        var alt = document.querySelector("[data-mp-auth]");
        var target = slot || alt;
        if (!target) return;

        var prof = getCurrentProfile();
        if (prof) {
            var nameLabel = escapeHtml(prof.user.displayName || prof.user.email);
            target.innerHTML =
                '<span class="header-user-chip">' +
                '<span class="header-user-dot" aria-hidden="true"></span>' +
                nameLabel +
                "</span>" +
                '<a class="btn btn-outline btn-nav" href="dashboard.html">Dashboard</a>' +
                '<button type="button" class="btn btn-ghost btn-nav" data-mp-logout>Log out</button>';
            var logoutBtn = target.querySelector("[data-mp-logout]");
            if (logoutBtn) logoutBtn.addEventListener("click", function () {
                logoutUser();
                refreshHeaderChrome();
                var path = window.location.pathname || "";
                if (/checkout\.html$/i.test(path) || /dashboard\.html$/i.test(path)) {
                    window.location.href = "index.html";
                } else {
                    window.location.reload();
                }
            });
        } else {
            target.innerHTML =
                '<a class="btn btn-ghost btn-nav" href="login.html">Log in</a>' +
                '<a class="btn btn-primary btn-nav" href="register.html">Register</a>';
        }
    }

    function initChrome() {
        seedDemoProducts();
        refreshHeaderChrome();
        document.body.addEventListener("mp-cart-updated", refreshHeaderChrome);
    }

    window.MarketpalaceApp = {
        escapeHtml: escapeHtml,
        formatMoney: formatMoney,
        uid: uid,
        getSession: getSession,
        registerUser: registerUser,
        loginUser: loginUser,
        logoutUser: logoutUser,
        getCurrentProfile: getCurrentProfile,
        isLoggedIn: isLoggedIn,
        requireLogin: requireLogin,
        getProducts: getProducts,
        addProductFromForm: addProductFromForm,
        getCart: getCart,
        addToCart: addToCart,
        setLineQty: setLineQty,
        removeFromCart: removeFromCart,
        clearCart: clearCart,
        getCartWithProducts: getCartWithProducts,
        cartItemCount: cartItemCount,
        getOrders: getOrders,
        placeOrder: placeOrder,
        refreshHeaderChrome: refreshHeaderChrome,
        initChrome: initChrome,
    };

    document.addEventListener("DOMContentLoaded", initChrome);
})();
