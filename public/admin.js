const BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3002'
    : 'https://adsvertiser.com';

// Check if user is admin
async function checkAdminAccess() {
    try {
        const response = await fetch(`${BASE_URL}/api/admin/check`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (!result.success || !result.isAdmin) {
            window.location.href = '/dashboard.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error checking admin access:', error);
        window.location.href = '/login';
        return false;
    }
}

// Fetch admin statistics
async function fetchAdminStats() {
    try {
        const response = await fetch(`${BASE_URL}/api/admin/stats`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('totalUsers').textContent = result.data.totalUsers;
            document.getElementById('totalCampaigns').textContent = result.data.totalCampaigns;
            document.getElementById('pendingCampaigns').textContent = result.data.pendingCampaigns;
            document.getElementById('totalBalance').textContent = `$${result.data.totalBalance}`;
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
        Toast.show('Failed to load statistics', 'error');
    }
}

// Fetch all users
async function fetchUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading users...</td></tr>';
    
    try {
        const response = await fetch(`${BASE_URL}/api/admin/users`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayUsers(result.data);
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Failed to load users</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Error loading users</td></tr>';
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><strong>$${parseFloat(user.balance || 0).toFixed(2)}</strong></td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-primary btn-small" onclick="openBalanceModal('${user._id}', '${user.username}', ${user.balance || 0})">
                        <span class="material-icons-sharp" style="font-size: 16px;">account_balance_wallet</span>
                        Balance
                    </button>
                    <button class="btn-danger btn-small" onclick="deleteUser('${user._id}', '${user.username}')">
                        <span class="material-icons-sharp" style="font-size: 16px;">delete</span>
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Fetch all campaigns
async function fetchCampaigns() {
    const tbody = document.getElementById('campaignsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading campaigns...</td></tr>';
    
    try {
        const response = await fetch(`${BASE_URL}/api/admin/campaigns`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayCampaigns(result.data);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">Failed to load campaigns</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Error loading campaigns</td></tr>';
    }
}

// Display campaigns in table
function displayCampaigns(campaigns) {
    const tbody = document.getElementById('campaignsTableBody');
    
    if (!campaigns || campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No campaigns found</td></tr>';
        return;
    }
    
    tbody.innerHTML = campaigns.map(campaign => `
        <tr>
            <td><strong>${campaign.campaignName}</strong></td>
            <td>${campaign.username}</td>
            <td><span class="status-badge ${campaign.status}">${campaign.status.toUpperCase()}</span></td>
            <td>$${parseFloat(campaign.price || 0).toFixed(2)}</td>
            <td>${new Date(campaign.createdAt).toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <select class="btn-small" onchange="updateCampaignStatus('${campaign._id}', this.value)" style="padding: 0.375rem 0.5rem;">
                        <option value="">Change Status</option>
                        <option value="active" ${campaign.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="pending" ${campaign.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="inactive" ${campaign.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        <option value="rejected" ${campaign.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
            </td>
        </tr>
    `).join('');
}

// Open balance modal
function openBalanceModal(userId, username, currentBalance) {
    document.getElementById('modalUserId').value = userId;
    document.getElementById('modalUsername').textContent = username;
    document.getElementById('modalCurrentBalance').textContent = parseFloat(currentBalance).toFixed(2);
    document.getElementById('balanceAmount').value = '';
    document.querySelector('input[name="action"][value="add"]').checked = true;
    
    const modal = document.getElementById('balanceModal');
    modal.classList.add('active');
}

// Close balance modal
function closeBalanceModal() {
    const modal = document.getElementById('balanceModal');
    modal.classList.remove('active');
}

// Handle balance form submission
// Handle balance form submission
document.addEventListener('DOMContentLoaded', () => {
    const balanceForm = document.getElementById('balanceForm');
    
    if (balanceForm) {
        balanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = document.getElementById('modalUserId').value;
            const amount = parseFloat(document.getElementById('balanceAmount').value);
            const action = document.querySelector('input[name="action"]:checked').value;
            
            console.log('Updating balance for user:', userId, 'Amount:', amount, 'Action:', action);
            
            if (!amount || amount <= 0) {
                Toast.show('Please enter a valid amount', 'error');
                return;
            }
            
            if (!userId) {
                Toast.show('User ID is missing', 'error');
                return;
            }
            
            try {
                const response = await fetch(`${BASE_URL}/api/admin/users/${userId}/balance`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ 
                        amount: parseFloat(amount), 
                        action: action 
                    })
                });
                
                const result = await response.json();
                
                console.log('Balance update response:', result);
                
                if (result.success) {
                    Toast.show(result.message, 'success');
                    closeBalanceModal();
                    fetchUsers();
                    fetchAdminStats();
                } else {
                    Toast.show(result.message || 'Failed to update balance', 'error');
                }
            } catch (error) {
                console.error('Error updating balance:', error);
                Toast.show('Error updating balance', 'error');
            }
        });
    }
});

// Delete user
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This will also delete all their campaigns.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            Toast.show(result.message, 'success');
            fetchUsers();
            fetchAdminStats();
        } else {
            Toast.show(result.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        Toast.show('Error deleting user', 'error');
    }
}

// Update campaign status
async function updateCampaignStatus(campaignId, newStatus) {
    if (!newStatus) return;
    
    try {
        const response = await fetch(`${BASE_URL}/api/admin/campaigns/${campaignId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (result.success) {
            Toast.show(result.message, 'success');
            fetchCampaigns();
            fetchAdminStats();
        } else {
            Toast.show(result.message || 'Failed to update campaign status', 'error');
        }
    } catch (error) {
        console.error('Error updating campaign status:', error);
        Toast.show('Error updating campaign status', 'error');
    }
}

// Show tab
function showTab(tabName) {
    // Update active tab
    document.querySelectorAll('.admin-content-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Update active nav item
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard Overview',
        'users': 'User Management',
        'campaigns': 'Campaign Management'
    };
    document.getElementById('pageTitle').textContent = titles[tabName] || 'Admin Panel';
    
    // Close mobile menu if open
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
    
    // Load data for the tab
    switch(tabName) {
        case 'dashboard':
            fetchAdminStats();
            break;
        case 'users':
            fetchUsers();
            break;
        case 'campaigns':
            fetchCampaigns();
            break;
    }
}

// Mobile menu handlers
function toggleMobileMenu() {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
}

// Navigation
document.addEventListener('DOMContentLoaded', async () => {
    // Check admin access
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return;
    
    // Setup navigation
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            if (tab) {
                showTab(tab);
            }
        });
    });
    
    // Mobile menu toggle
    const mobileToggle = document.getElementById('adminMobileToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobileMenu);
    }
    
    const closeSidebar = document.getElementById('adminCloseSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', closeMobileMenu);
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('adminSidebar');
        const mobileToggle = document.getElementById('adminMobileToggle');
        
        if (sidebar && mobileToggle) {
            if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
                    closeMobileMenu();
                }
            }
        }
    });
    
    // Logout
    document.getElementById('adminLogout').addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            const response = await fetch(`${BASE_URL}/logout`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout error:', error);
            Toast.show('Error logging out', 'error');
        }
    });
    
    // Close modal when clicking outside
    const modal = document.getElementById('balanceModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBalanceModal();
        }
    });
    
    // Load initial data
    showTab('dashboard');
    
    // Search functionality
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#usersTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
    
    // Campaign search
    const campaignSearch = document.getElementById('campaignSearch');
    if (campaignSearch) {
        campaignSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#campaignsTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
});