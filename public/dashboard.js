const BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : 'https://adsvertisernew-1.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logoutButton');
    
    logoutButton.addEventListener('click', async function() {
        try {
            const response = await fetch('/logout', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                window.location.href = '/login';
            } else {
                Toast.show("Failed to logout. Please try again.");
            }
        } catch (error) {
            Toast.show("An error occurred during logout. Please try again.");
        }
    });
});

function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
}

async function fetchData(startDate, endDate) {
    if (!startDate || !endDate) {
        if (document.body.getAttribute('data-active-tab') === 'performance') {
            startDate = document.getElementById('startDate').value;
            endDate = document.getElementById('endDate').value;
        } else if (document.body.getAttribute('data-active-tab') === 'datatable') {
            startDate = document.getElementById('startDateTable').value;
            endDate = document.getElementById('endDateTable').value;
        }
    }

    try {
        const response = await fetch(
            `${BASE_URL}/performance-report?startDate=${startDate}&endDate=${endDate}&groupBy=date`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            const errorText = await response.text(); 
            throw new Error('Failed to retrieve data');
        }

        const result = await response.json();

        if (!result.data || !result.data.items) {
            throw new Error('No data available');
        }

        updateChart(result.data.items);
        updateTable(result.data.items);
        updateSummaryStats(result.data.items);
    } catch (error) {
        Toast.show("Complete date fields!");
    } finally {
    }
}

// FIXED: Simple campaign fetching from database
async function fetchCampaignData() {
    const loadingDiv = document.getElementById('loading');
    
    console.log('Fetching campaigns from database...');

    if (loadingDiv) loadingDiv.style.display = 'block';

    try {
        // Fetch campaigns directly from our database API
        const response = await fetch(`${BASE_URL}/api/campaigns`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        console.log('Campaign response status:', response.status);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Please log in to view campaigns');
            }
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || 'Failed to fetch campaigns');
        }

        const result = await response.json();
        console.log('Campaign response data:', result);
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch campaigns');
        }

        if (!result.data || result.data.length === 0) {
            displayNoCampaigns();
            return;
        }

        populateCampaignTable(result.data);
        
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        
        let errorMessage = 'Unable to load campaigns';
        if (error.message.includes('log in') || error.message.includes('Authentication')) {
            errorMessage = 'Please log in to view your campaigns';
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        }
        
        if (window.Toast) {
            Toast.show(errorMessage, 'error');
        }
        
        displayNoCampaigns();
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}

// Display message when no campaigns found
function displayNoCampaigns() {
    const campaignTableBody = document.getElementById('campaignTableBody');
    if (campaignTableBody) {
        campaignTableBody.innerHTML = `
            <div class="campaign-card empty" style="text-align: center; padding: 40px; color: #666;">
                <p style="font-size: 18px; margin-bottom: 10px;">No campaigns found</p>
                <p style="font-size: 14px;">Create your first campaign to get started!</p>
            </div>
        `;
    }
}

function updateTable(data) {
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        const ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : '0.00';

        row.innerHTML = `
            <td>${item.date || item.campaign}</td>
            <td>${item.impressions?.toLocaleString() || 0}</td>
            <td>${item.clicks?.toLocaleString() || 0}</td>
            <td>$${parseFloat(item.spend || 0).toFixed(2)}</td>
            <td>${ctr}%</td>
        `;
        tbody.appendChild(row);
    });
}

function updateSummaryStats(data) {
    const summaryStatsDiv = document.getElementById('summaryStats');
    if (!summaryStatsDiv) return;

    const totalImpressions = data.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const totalClicks = data.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const totalSpend = data.reduce((sum, item) => sum + parseFloat(item.spend || 0), 0);
    const avgCTR = (totalClicks / totalImpressions * 100 || 0).toFixed(2);

    summaryStatsDiv.innerHTML = `
        <div class="stat-card">
            <h3>Total Impressions</h3>
            <p>${totalImpressions.toLocaleString()}</p>
        </div>
        <div class="stat-card">
            <h3>Total Clicks</h3>
            <p>${totalClicks.toLocaleString()}</p>
        </div>
        <div class="stat-card">
            <h3>Total Spend</h3>
            <p>$${totalSpend.toFixed(2)}</p>
        </div>
        <div class="stat-card">
            <h3>Average CTR</h3>
            <p>${avgCTR}%</p>
        </div>
    `;
}

// UPDATED: Simplified campaign table population
function populateCampaignTable(campaigns) {
    const tableBody = document.getElementById('campaignTableBody');
    if (!tableBody) {
        console.error('Campaign table body not found');
        return;
    }

    tableBody.innerHTML = '';

    campaigns.forEach(campaign => {
        const card = document.createElement('div');
        card.className = 'campaign-card';

        // Format the date
        const createdDate = new Date(campaign.createdAt).toLocaleDateString();
        
        // Create status badge
        const statusClass = campaign.status === 'active' ? 'success' : 
                           campaign.status === 'pending' ? 'warning' : 'danger';
        
        card.innerHTML = `
            <div class="campaign-info">
                <div class="campaign-header">
                    <h4 class="campaign-name">${campaign.campaignName}</h4>
                    <span class="status-badge ${statusClass}">${campaign.status.toUpperCase()}</span>
                </div>
                <div class="campaign-details">
                    <div class="detail-row">
                        <span class="label">Device:</span>
                        <span class="value">${campaign.deviceFormat}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Traffic Type:</span>
                        <span class="value">${campaign.trafficType}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Ad Unit:</span>
                        <span class="value">${campaign.adUnit}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Pricing:</span>
                        <span class="value">${campaign.pricingType.toUpperCase()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Countries:</span>
                        <span class="value">${campaign.countries.slice(0, 3).join(', ')}${campaign.countries.length > 3 ? ` +${campaign.countries.length - 3} more` : ''}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Budget:</span>
                        <span class="value price">$${campaign.price}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Created:</span>
                        <span class="value">${createdDate}</span>
                    </div>
                </div>
                <div class="campaign-actions">
                    <button class="btn-small btn-primary" onclick="viewCampaign('${campaign._id}')">View</button>
                    <button class="btn-small btn-secondary" onclick="editCampaign('${campaign._id}')">Edit</button>
                    <button class="btn-small btn-danger" onclick="deleteCampaign('${campaign._id}')">Delete</button>
                </div>
            </div>
        `;

        tableBody.appendChild(card);
    });
}

// Campaign action functions
function viewCampaign(campaignId) {
    console.log('View campaign:', campaignId);
    // You can implement campaign viewing logic here
    Toast.show('Campaign view feature coming soon!', 'info');
}

function editCampaign(campaignId) {
    console.log('Edit campaign:', campaignId);
    // You can implement campaign editing logic here
    Toast.show('Campaign edit feature coming soon!', 'info');
}

async function deleteCampaign(campaignId) {
    if (!confirm('Are you sure you want to delete this campaign?')) {
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/campaigns/${campaignId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            Toast.show('Campaign deleted successfully!', 'success');
            // Refresh the campaign list
            fetchCampaignData();
        } else {
            Toast.show(result.message || 'Failed to delete campaign', 'error');
        }
    } catch (error) {
        console.error('Error deleting campaign:', error);
        Toast.show('Error deleting campaign', 'error');
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('.sidebar a');

    links.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            showTab(targetId);
        });
    });

    // Set up date inputs
    setDefaultDates();

    // Show dashboard/welcome page by default
    showTab('dashboard');
});

// Mobile menu handlers
const sideMenu = document.querySelector("aside");
const menuBtn = document.querySelector("#menu-btn");
const closeBtn = document.querySelector("#close-btn");

if (menuBtn) {
    menuBtn.addEventListener("click", () => {
        sideMenu.style.display = "block";
    });
}

if (closeBtn) {
    closeBtn.addEventListener("click", () => {
        sideMenu.style.display = "none";
    });
}

// REMOVED: Date change handlers for campaigns (no longer needed)
// Only keep date handlers for performance reports

document.getElementById('startDate')?.addEventListener('change', () => {
    const activeTab = document.querySelector('.tab-content[style="display: block"]')?.id;
    if (activeTab === 'performance' || activeTab === 'datatable') {
        fetchData();
    }
});

document.getElementById('endDate')?.addEventListener('change', () => {
    const activeTab = document.querySelector('.tab-content[style="display: block"]')?.id;
    if (activeTab === 'performance' || activeTab === 'datatable') {
        fetchData();
    }
});

function showTab(targetId) {
    const tabContents = document.querySelectorAll('.tab-content');
    const links = document.querySelectorAll('.sidebar a');
    const paymentForm = document.getElementById('paymentForm');

    // Hide payment form unless explicitly showing it
    if (paymentForm && targetId !== 'payment') {
        paymentForm.classList.add('hidden');
    }

    tabContents.forEach(content => {
        content.style.display = content.id === targetId ? 'block' : 'none';
    });

    links.forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar a[href="#${targetId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    document.body.setAttribute('data-active-tab', targetId);

    const dateDiv = document.getElementById('dateDiv');
    if (dateDiv) {
        // Hide date inputs for campaigns since we don't need them anymore
        const hideDateTabs = ['dashboard', 'newCampaign', 'support', 'traffic', 'campaign'];
        dateDiv.style.display = hideDateTabs.includes(targetId) ? 'none' : 'block';
    }

    // Handle tab-specific actions
    switch (targetId) {
        case 'campaign':
            // Simply fetch campaigns from database - no date needed
            fetchCampaignData();
            break;
        case 'performance':
        case 'datatable':
            fetchData();
            break;
        case 'traffic':
            window.trafficModule?.fetchTrafficData();
            break;
        case 'newCampaign':
            handleNewCampaignTab();
            break;
        case 'payment':
            if (paymentForm) {
                paymentForm.classList.remove('hidden');
            }
            break;
    }
}

function handleNewCampaignTab() {
    const selectedCountry = sessionStorage.getItem('selectedCountry');
    const recommendedCPM = sessionStorage.getItem('recommendedCPM');
    
    if (selectedCountry) {
        const countryOptions = document.querySelectorAll('.country-option');
        countryOptions.forEach(option => {
            if (option.textContent.includes(selectedCountry.split(' - ')[0])) {
                option.click();
            }
        });
    }

    if (recommendedCPM) {
        const budgetInput = document.getElementById('budget');
        if (budgetInput) {
            budgetInput.value = parseFloat(recommendedCPM.replace('$', ''));
        }
    }

    sessionStorage.removeItem('selectedCountry');
    sessionStorage.removeItem('recommendedCPM');
}

// SIMPLIFIED: Only handle date changes for performance reports
function handleDateChange() {
    const activeTab = document.body.getAttribute('data-active-tab');
    let startDate, endDate;

    switch (activeTab) {
        case 'performance':
            startDate = document.getElementById('startDate').value;
            endDate = document.getElementById('endDate').value;
            fetchData(startDate, endDate);
            break;
        case 'datatable':
            startDate = document.getElementById('startDateTable').value;
            endDate = document.getElementById('endDateTable').value;
            fetchData(startDate, endDate);
            break;
        // Removed campaign case - no longer needs date handling
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        const icon = question.querySelector('.material-icons-sharp');

        if (question && answer && icon) {
            question.addEventListener('click', () => {
                // Toggle active class
                item.classList.toggle('active');

                // Slide toggle answer
                if (answer.style.maxHeight) {
                    answer.style.maxHeight = null;
                    icon.textContent = 'expand_more';
                } else {
                    answer.style.maxHeight = answer.scrollHeight + "px";
                    icon.textContent = 'expand_less';
                }

                // Close other FAQ items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                        const otherAnswer = otherItem.querySelector('.faq-answer');
                        const otherIcon = otherItem.querySelector('.material-icons-sharp');
                        if (otherAnswer && otherIcon) {
                            otherAnswer.style.maxHeight = null;
                            otherIcon.textContent = 'expand_more';
                        }
                    }
                });
            });
        }
    });
});