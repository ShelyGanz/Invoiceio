// Initialize Telegram WebApp
Telegram.WebApp.ready();

const loadingScreen = document.getElementById('loading-screen');
const mainScreen = document.getElementById('main-screen');
const invoiceForm = document.getElementById('invoice-form');
const invoiceListScreen = document.getElementById('invoice-list-screen');
const settingsPanel = document.getElementById('settings-panel');
const invoiceDetails = document.getElementById('invoice-details');
const userInfo = document.getElementById('user-info');
const createInvoiceButton = document.getElementById('create-invoice-button');
const deleteAllInvoicesButton = document.getElementById('delete-all-invoices-button');
const newInvoiceForm = document.getElementById('new-invoice-form');
const invoiceList = document.getElementById('invoice-list');
const invoiceSummaryList = document.getElementById('invoice-summary-list');
const viewAllInvoicesButton = document.getElementById('view-all-invoices-button');
const noInvoicesMessage = document.getElementById('no-invoices-message');
const createInvoiceLink = document.getElementById('create-invoice-link');
const statusFilters = document.querySelectorAll('.status-filter button');
const addItemButton = document.getElementById('add-item');
const settingsButton = document.getElementById('settings-button');
const saveSettingsButton = document.getElementById('save-settings-button');
const currencyList = document.getElementById('currency-list');
const currencySearch = document.getElementById('currency-search');

let user = null;
let invoices = [];
const currencyApiUrl = 'https://openexchangerates.org/api/currencies.json';
const currencyApiKey = 'YOUR_API_KEY_HERE'; // Replace with your Open Exchange Rates API key

// Automatic user authorization
function authorizeUser() {
    if (Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
        user = {
            id: Telegram.WebApp.initDataUnsafe.user.id,
            name: Telegram.WebApp.initDataUnsafe.user.first_name,
            username: Telegram.WebApp.initDataUnsafe.user.username,
            photo: Telegram.WebApp.initDataUnsafe.user.photo_url
        };
        
        if (user.id) {
            loadingScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            userInfo.innerHTML = `Welcome, ${user.name}!`;
            loadInvoices();
            updateIncomeSummary();
            Telegram.WebApp.MainButton.hide();
            loadCurrencies();
        } else {
            alert('Authorization failed. Please try again.');
        }
    } else {
        alert('Unable to retrieve user data. Please make sure you\'re opening this app from Telegram.');
    }
}

// Call authorize function when the app is ready
Telegram.WebApp.onEvent('mainButtonClicked', saveInvoice);

// Automatically try to authorize when the page loads
window.addEventListener('load', authorizeUser);

// Load currencies from API and populate the dropdown
function loadCurrencies() {
    fetch(`${currencyApiUrl}?app_id=${currencyApiKey}`)
        .then(response => response.json())
        .then(data => {
            const currencies = Object.entries(data).map(([code, name]) => ({
                code,
                name,
                symbol: getCurrencySymbol(code)
            }));
            displayCurrencies(currencies);
        })
        .catch(error => console.error('Error loading currencies:', error));
}

// Get currency symbol (this can be improved with a more complete mapping)
function getCurrencySymbol(code) {
    const symbols = {
        USD: '$',
        CAD: 'CA$',
        EUR: '€'
        // Add more currency symbols as needed
    };
    return symbols[code] || code;
}

// Display the list of currencies
function displayCurrencies(currencies) {
    currencyList.innerHTML = '';
    currencies.forEach(currency => {
        const li = document.createElement('li');
        li.classList.add('currency-item');
        li.dataset.code = currency.code;
        li.innerHTML = `
            <span class="currency-symbol">${currency.symbol}</span>
            <span class="currency-name">${currency.name} (${currency.code})</span>
        `;
        li.addEventListener('click', () => selectCurrency(currency.code));
        currencyList.appendChild(li);
    });
}

// Select currency
function selectCurrency(code) {
    const selectedCurrency = document.querySelector('.currency-item.selected');
    if (selectedCurrency) {
        selectedCurrency.classList.remove('selected');
    }
    const newSelectedCurrency = document.querySelector(`.currency-item[data-code="${code}"]`);
    if (newSelectedCurrency) {
        newSelectedCurrency.classList.add('selected');
    }
}

// Filter currencies
currencySearch.addEventListener('input', () => {
    const query = currencySearch.value.toLowerCase();
    document.querySelectorAll('.currency-item').forEach(item => {
        const name = item.querySelector('.currency-name').textContent.toLowerCase();
        if (name.includes(query)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
});

// Create new invoice
createInvoiceButton.addEventListener('click', showInvoiceForm);
createInvoiceLink.addEventListener('click', showInvoiceForm);

function showInvoiceForm() {
    mainScreen.classList.add('hidden');
    invoiceForm.classList.remove('hidden');
    document.getElementById('invoice-number').value = invoices.length + 1;
    document.getElementById('invoice-date').valueAsDate = new Date();
    document.getElementById('payment-due').valueAsDate = new Date();
    Telegram.WebApp.MainButton.setText('Save Invoice');
    Telegram.WebApp.MainButton.show();
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(closeForm);
}

// Delete all invoices
deleteAllInvoicesButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all invoices?')) {
        invoices = [];
        saveInvoices();
        renderInvoices();
        updateIncomeSummary();
        Telegram.WebApp.showPopup({
            title: 'All Invoices Deleted',
            message: 'All invoices have been successfully deleted.',
            buttons: [{type: 'ok'}]
        });
    }
});

// Show settings panel
settingsButton.addEventListener('click', () => {
    mainScreen.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(closeSettings);
});

// Back from settings panel
function closeSettings() {
    settingsPanel.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    Telegram.WebApp.BackButton.hide();
}

// Save settings
saveSettingsButton.addEventListener('click', () => {
    const language = document.getElementById('language').value;
    const selectedCurrencyItem = document.querySelector('.currency-item.selected');
    const defaultCurrency = selectedCurrencyItem ? selectedCurrencyItem.dataset.code : 'USD';
    const showBalances = document.getElementById('show-balances').checked;
    
    // Save settings to localStorage or send to server
    const settings = {
        language,
        defaultCurrency,
        showBalances
    };
    localStorage.setItem(`settings_${user.id}`, JSON.stringify(settings));
    
    settingsPanel.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    Telegram.WebApp.BackButton.hide();
    
    Telegram.WebApp.showPopup({
        title: 'Settings Saved',
        message: 'Your settings have been successfully saved.',
        buttons: [{type: 'ok'}]
    });
});

// Save invoice
function saveInvoice() {
    const newInvoice = {
        id: Date.now(),
        businessDetails: document.getElementById('business-details').value,
        title: document.getElementById('invoice-title').value,
        summary: document.getElementById('invoice-summary').value,
        number: document.getElementById('invoice-number').value,
        poNumber: document.getElementById('po-number').value,
        date: document.getElementById('invoice-date').value,
        paymentDue: document.getElementById('payment-due').value,
        customerDetails: document.getElementById('customer-details').value,
        items: getItemsFromTable(),
        subtotal: document.getElementById('subtotal').value,
        total: document.getElementById('total').value,
        currency: document.getElementById('currency').value,
        notes: document.getElementById('notes').value,
        footer: document.getElementById('footer').value,
        status: 'draft'
    };
    invoices.push(newInvoice);
    saveInvoices();
    renderInvoices();
    updateIncomeSummary();
    invoiceForm.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    newInvoiceForm.reset();
    Telegram.WebApp.MainButton.hide();
    Telegram.WebApp.BackButton.hide();
    
    // Show popup notification
    Telegram.WebApp.showPopup({
        title: 'Invoice Created',
        message: `Invoice #${newInvoice.number} has been created successfully.`,
        buttons: [{type: 'ok'}]
    });
}

function loadInvoices() {
    const savedInvoices = localStorage.getItem(`invoices_${user.id}`);
    if (savedInvoices) {
        invoices = JSON.parse(savedInvoices);
        renderInvoices();
    }
}

function saveInvoices() {
    localStorage.setItem(`invoices_${user.id}`, JSON.stringify(invoices));
}

function renderInvoices(filter = 'all') {
    mainScreen.classList.remove('hidden');
    invoiceList.innerHTML = '';
    invoices.forEach(invoice => {
        if (filter === 'all' || invoice.status === filter) {
            const tr = document.createElement('tr');
            tr.addEventListener('click', () => viewInvoiceDetails(invoice.id));
            tr.innerHTML = `
                <td><span class="status-indicator status-${invoice.status}">${invoice.status}</span></td>
                <td>${new Date(invoice.date).toLocaleDateString()}</td>
                <td>${invoice.number}</td>
                <td>${invoice.currency} ${invoice.total}</td>
            `;
            invoiceList.appendChild(tr);
        }
    });
    renderRecentInvoices();
    updateIncomeSummary();
}

function renderRecentInvoices() {
    invoiceSummaryList.innerHTML = '';
    if (invoices.length === 0) {
        noInvoicesMessage.classList.remove('hidden');
        viewAllInvoicesButton.classList.add('hidden');
    } else {
        noInvoicesMessage.classList.add('hidden');
        viewAllInvoicesButton.classList.remove('hidden');
        const recentInvoices = invoices.slice(-3).reverse();
        recentInvoices.forEach(invoice => {
            const div = document.createElement('div');
            div.classList.add('invoice-item');
            div.addEventListener('click', () => viewInvoiceDetails(invoice.id));
            div.innerHTML = `
                <div class="invoice-info">
                    <div class="invoice-amount">${invoice.currency} ${invoice.total}</div>
                    <div class="invoice-date">${new Date(invoice.date).toLocaleDateString()}</div>
                </div>
                <div class="invoice-title">${invoice.title}</div>
            `;
            invoiceSummaryList.appendChild(div);
        });
    }
}

viewAllInvoicesButton.addEventListener('click', () => {
    mainScreen.classList.add('hidden');
    invoiceListScreen.classList.remove('hidden');
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(() => {
        invoiceListScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        Telegram.WebApp.BackButton.hide();
    });
});

function viewInvoiceDetails(id) {
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice) {
        mainScreen.classList.add('hidden');
        invoiceListScreen.classList.add('hidden');
        invoiceDetails.classList.remove('hidden');
        const detailsScreen = document.createElement('div');
        detailsScreen.innerHTML = `
            <h2>Invoice ${invoice.number}</h2>
            <p>Status: <span class="status-indicator status-${invoice.status}">${invoice.status}</span></p>
            <p>Date: ${new Date(invoice.date).toLocaleDateString()}</p>
            <p>Customer: ${invoice.customerDetails}</p>
            <p>Total: ${invoice.currency} ${invoice.total}</p>
            <h3>Items</h3>
            <ul>
                ${invoice.items.map(item => `<li>${item.description} - ${item.quantity} x ${item.price} = ${item.amount}</li>`).join('')}
            </ul>
            <button onclick="confirmDeleteInvoice(${invoice.id})" class="delete-button">Delete Invoice</button>
            <button onclick="previewInvoice(${invoice.id})" class="preview-button">Preview Invoice</button>
        `;
        document.getElementById('invoice-details-content').innerHTML = detailsScreen.innerHTML;
        Telegram.WebApp.BackButton.show();
        Telegram.WebApp.BackButton.onClick(closeInvoiceDetails);
    }
}

function confirmDeleteInvoice(id) {
    Telegram.WebApp.showConfirm(
        "Are you sure you want to delete this invoice?",
        (confirmed) => {
            if (confirmed) {
                deleteInvoice(id);
            }
        }
    );
}

function closeInvoiceDetails() {
    invoiceDetails.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    invoiceListScreen.classList.remove('hidden');
    Telegram.WebApp.BackButton.hide();
}

function deleteInvoice(id) {
    Telegram.WebApp.showConfirm(
        "Are you sure you want to delete this invoice?",
        (confirmed) => {
            if (confirmed) {
                invoices = invoices.filter(inv => inv.id !== id);
                saveInvoices();
                renderInvoices();
                updateIncomeSummary();
                closeInvoiceDetails();
                
                // Show a notification that the invoice was deleted
                Telegram.WebApp.showPopup({
                    title: 'Invoice Deleted',
                    message: 'The invoice has been successfully deleted.',
                    buttons: [{type: 'ok'}]
                });
                mainScreen.classList.remove('hidden');
            }
        }
    );
}

function previewInvoice(id) {
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice) {
        const previewScreen = document.createElement('div');
        previewScreen.id = 'invoice-preview';
        previewScreen.innerHTML = `
            <button class="back-button" onclick="closePreview()">&#8592;</button>
            <h2>Invoice Preview</h2>
            <div class="preview-toggle">
                <button class="active" onclick="togglePreview('mobile')">Mobile</button>
                <button onclick="togglePreview('desktop')">Desktop</button>
            </div>
            <div class="preview-container">
                <img src="/api/placeholder/300/500" alt="Invoice Preview" id="preview-image">
            </div>
        `;
        document.body.appendChild(previewScreen);
    }
}

function closePreview() {
    const previewScreen = document.getElementById('invoice-preview');
    if (previewScreen) {
        previewScreen.remove();
    }
}

function togglePreview(type) {
    const buttons = document.querySelectorAll('.preview-toggle button');
    buttons.forEach(button => button.classList.remove('active'));
    event.target.classList.add('active');
    // In a real implementation, you would update the preview image here
    // For this example, we'll just use a placeholder
    document.getElementById('preview-image').src = `/api/placeholder/${type === 'mobile' ? '300/500' : '600/800'}`;
}

function updateIncomeSummary() {
    const totalIncome = invoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + parseFloat(invoice.total), 0);
    
    document.getElementById('total-income').textContent = `$${totalIncome.toFixed(2)}`;
}

function getItemsFromTable() {
    const items = [];
    const rows = document.querySelectorAll('#item-rows tr');
    rows.forEach(row => {
        items.push({
            description: row.querySelector('.item-description').value,
            quantity: row.querySelector('.item-quantity').value,
            price: row.querySelector('.item-price').value,
            amount: row.querySelector('.item-amount').value
        });
    });
    return items;
}

function addItemRow(item = null) {
    const tbody = document.getElementById('item-rows');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" class="item-description" value="${item ? item.description : ''}" placeholder="Description"></td>
        <td><input type="number" class="item-quantity" value="${item ? item.quantity : '1'}" min="1" placeholder="Qty"></td>
        <td><input type="number" class="item-price" value="${item ? item.price : '0.00'}" min="0" step="0.01" placeholder="Price"></td>
        <td><input type="number" class="item-amount" value="${item ? item.amount : '0.00'}" readonly></td>
    `;
    tbody.appendChild(newRow);
    updateTotals();
}

function updateTotals() {
    let subtotal = 0;
    const rows = document.querySelectorAll('#item-rows tr');
    rows.forEach(row => {
        const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const amount = quantity * price;
        row.querySelector('.item-amount').value = amount.toFixed(2);
        subtotal += amount;
    });
    document.getElementById('subtotal').value = subtotal.toFixed(2);
    document.getElementById('total').value = subtotal.toFixed(2);
}

// Event listeners
document.getElementById('add-item').addEventListener('click', () => addItemRow());

document.getElementById('items-table').addEventListener('input', (e) => {
    if (e.target.classList.contains('item-quantity') || e.target.classList.contains('item-price')) {
        updateTotals();
    }
});

statusFilters.forEach(button => {
    button.addEventListener('click', () => {
        statusFilters.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        renderInvoices(button.dataset.status);
    });
});

// Logo upload functionality
document.getElementById('logo-upload-area').addEventListener('click', () => {
    document.getElementById('logo-upload').click();
});

document.getElementById('logo-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            document.getElementById('logo-upload-area').innerHTML = '';
            document.getElementById('logo-upload-area').appendChild(img);
        }
        reader.readAsDataURL(file);
    }
});

// Initialize the app
authorizeUser();

function closeForm() {
    invoiceForm.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    Telegram.WebApp.MainButton.hide();
    Telegram.WebApp.BackButton.hide();
}

function changeInvoiceStatus(status) {
    const invoiceId = parseInt(document.getElementById('invoice-details').dataset.invoiceId);
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        invoice.status = status;
        saveInvoices();
        renderInvoices();
        viewInvoiceDetails(invoiceId);
        Telegram.WebApp.showPopup({
            title: 'Invoice Status Changed',
            message: `The status of Invoice #${invoice.number} has been changed to ${status}.`,
            buttons: [{type: 'ok'}]
        });
    }
}
