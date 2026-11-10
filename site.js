(function () {
  'use strict';
  var businessId = 20;
  var api = '/api/public/negocios/' + businessId;
  var localPreview = location.protocol === 'file:';
  var page = document.body.getAttribute('data-page') || 'inicio';
  if (page === '__PAGE__') {
    var requestedPage = new URLSearchParams(location.search).get('page');
    var routeParts = location.pathname.split('/').filter(Boolean);
    var routePage = routeParts[0] === 'bossio' ? (routeParts[1] || 'inicio') : 'inicio';
    page = requestedPage || (localPreview ? 'inicio' : routePage);
  }
  var validPages = ['inicio', 'panaderia', 'pastas', 'cafe', 'contacto', 'pedidos'];
  if (page === 'bossio' || validPages.indexOf(page) === -1) page = 'inicio';
  var titles = {
    inicio: 'Bossio | Panadería, Pastas y Café',
    panaderia: 'Panadería | Bossio',
    pastas: 'Pastas artesanales | Bossio',
    cafe: 'Café y locales | Bossio',
    contacto: 'Locales y catering | Bossio',
    pedidos: 'Catálogo y pedidos | Bossio'
  };
  function showPage(nextPage) {
    page = validPages.indexOf(nextPage) === -1 ? 'inicio' : nextPage;
    document.title = titles[page] || titles.inicio;
    document.querySelectorAll('[data-view]').forEach(function (view) {
      view.classList.toggle('active', view.getAttribute('data-view') === page);
    });
    document.querySelectorAll('.nav-links a').forEach(function (link) {
      var name = link.pathname.split('/').filter(Boolean).pop() || 'inicio';
      if (name === 'bossio' || validPages.indexOf(name) === -1) name = 'inicio';
      if (name === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  showPage(page);
  if (localPreview) document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href^="/bossio"]');
    if (!link) return;
    event.preventDefault();
    var parts = link.pathname.split('/').filter(Boolean);
    var destination = parts[0] === 'bossio' ? (parts[1] || 'inicio') : 'inicio';
    showPage(destination);
    if (nav) nav.classList.remove('open');
  });
  var menu = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.nav-links');
  if (menu && nav) menu.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });

  var quote = document.getElementById('quote-form');
  if (quote) quote.addEventListener('submit', async function (event) {
    event.preventDefault();
    var button = quote.querySelector('button[type="submit"]');
    var message = document.getElementById('quote-message');
    button.disabled = true;
    message.textContent = 'Enviando tu consulta…';
    try {
      var response = await fetch(api + '/presupuestos-web', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.fromEntries(new FormData(quote).entries()))
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No pudimos enviar la consulta.');
      quote.reset();
      message.textContent = '¡Gracias! Tu consulta llegó al equipo Bossio.';
    } catch (error) {
      message.textContent = error.message || 'No pudimos enviar la consulta. Intentá nuevamente.';
    } finally {
      button.disabled = false;
    }
  });
  if (page !== 'pedidos') return;

  var products = [];
  var categories = [];
  var cart = new Map();
  var selectedCategory = 'all';
  var grid = document.getElementById('products');
  var filters = document.getElementById('filters');
  var status = document.getElementById('catalog-status');
  var search = document.getElementById('product-search');
  var items = document.getElementById('cart-items');
  var count = document.getElementById('cart-count');
  var total = document.getElementById('cart-total');
  var send = document.getElementById('send-order');
  function money(value) {
    return new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 2}).format(Number(value) || 0);
  }
  function safe(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char];
    });
  }
  function safeImage(value) {
    try {
      var url = new URL(value, location.origin);
      return (url.protocol === 'https:' || url.origin === location.origin) ? url.href : '';
    } catch (_) { return ''; }
  }
  function drawProducts() {
    var term = (search.value || '').trim().toLocaleLowerCase('es-AR');
    var shown = products.filter(function (product) {
      var categoryMatch = selectedCategory === 'all' || String(product.categoria_id) === selectedCategory;
      var text = [product.nombre, product.categoria_nombre, product.sku].join(' ').toLocaleLowerCase('es-AR');
      return categoryMatch && text.includes(term);
    });
    grid.innerHTML = shown.map(function (product) {
      var src = safeImage(product.imagen_url);
      var image = src ? '<img src="' + safe(src) + '" alt="" loading="lazy">' : '<span>B</span>';
      var available = Number(product.stock) > 0;
      return '<article class="product-card"><div class="product-thumb">' + image + '</div><h3>' + safe(product.nombre) + '</h3><span class="product-meta">' + safe(product.categoria_nombre || 'Bossio') + '</span><p class="product-price">' + money(product.precio_venta) + '</p><button class="add-button" data-add="' + Number(product.id) + '" ' + (available ? '' : 'disabled') + '>' + (available ? 'Agregar al pedido +' : 'Sin disponibilidad') + '</button></article>';
    }).join('');
    status.textContent = shown.length ? shown.length + ' productos disponibles en Casa Central' : (products.length ? 'No encontramos productos con esos filtros.' : 'No hay productos disponibles para mostrar.');
  }
  function drawFilters() {
    filters.innerHTML = '<button class="filter-chip ' + (selectedCategory === 'all' ? 'active' : '') + '" data-category="all">Todo</button>' + categories.map(function (category) {
      return '<button class="filter-chip ' + (selectedCategory === String(category.id) ? 'active' : '') + '" data-category="' + Number(category.id) + '">' + safe(category.nombre) + '</button>';
    }).join('');
  }
  function drawCart() {
    var lines = Array.from(cart.values());
    var quantity = lines.reduce(function (sum, line) { return sum + line.cantidad; }, 0);
    var amount = lines.reduce(function (sum, line) { return sum + line.cantidad * Number(line.precio_venta || 0); }, 0);
    count.textContent = String(quantity);
    total.textContent = money(amount);
    send.disabled = quantity === 0;
    items.innerHTML = lines.length ? lines.map(function (line) {
      return '<div class="cart-line"><div><h4>' + safe(line.nombre) + '</h4><small>' + money(line.precio_venta) + ' c/u</small></div><div class="quantity-tools"><button type="button" data-qty="-1" data-id="' + Number(line.id) + '" aria-label="Quitar uno">−</button><span>' + line.cantidad + '</span><button type="button" data-qty="1" data-id="' + Number(line.id) + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<p class="empty-cart">Todavía no agregaste productos.</p>';
  }
  filters.addEventListener('click', function (event) {
    var button = event.target.closest('[data-category]');
    if (!button) return;
    selectedCategory = button.dataset.category;
    drawFilters(); drawProducts();
  });
  search.addEventListener('input', drawProducts);
  grid.addEventListener('click', function (event) {
    var button = event.target.closest('[data-add]');
    if (!button) return;
    var product = products.find(function (item) { return Number(item.id) === Number(button.dataset.add); });
    if (!product) return;
    var line = cart.get(product.id) || Object.assign({}, product, {cantidad: 0});
    line.cantidad += 1; cart.set(product.id, line); drawCart();
  });
  items.addEventListener('click', function (event) {
    var button = event.target.closest('[data-qty]');
    if (!button) return;
    var line = cart.get(Number(button.dataset.id));
    if (!line) return;
    line.cantidad += Number(button.dataset.qty);
    if (line.cantidad <= 0) cart.delete(line.id);
    drawCart();
  });
  document.getElementById('order-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var form = event.currentTarget;
    var message = document.getElementById('order-message');
    var data = Object.fromEntries(new FormData(form).entries());
    data.detalles = Array.from(cart.values()).map(function (line) { return {producto_id: Number(line.id), cantidad: line.cantidad}; });
    send.disabled = true; message.textContent = 'Enviando tu pedido…';
    try {
      var response = await fetch(api + '/pedidos', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No pudimos enviar el pedido.');
      cart.clear(); drawCart(); form.reset();
      message.textContent = '¡Listo! Recibimos tu pedido #' + result.numero_interno + '. El equipo Bossio lo preparará.';
    } catch (error) {
      message.textContent = error.message || 'No pudimos enviar el pedido. Intentá nuevamente.';
    } finally { send.disabled = cart.size === 0; }
  });
  drawCart();
  fetch(api + '/productos', {headers: {Accept: 'application/json'}}).then(function (response) {
    return response.json().then(function (result) { if (!response.ok) throw new Error('No se pudo cargar el catálogo.'); return result; });
  }).then(function (result) {
    products = result.productos || []; categories = result.categorias || [];
    drawFilters(); drawProducts();
  }).catch(function () { status.textContent = 'No pudimos cargar el catálogo. Probá recargar la página en unos minutos.'; });
})();
