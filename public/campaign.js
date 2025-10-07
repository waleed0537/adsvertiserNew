const API_ENDPOINTS = {
    local: 'http://localhost:3002',
    production: 'https://adsvertiser.com',
};

const BASE_URL = window.location.hostname === 'localhost' ? API_ENDPOINTS.local : API_ENDPOINTS.production;

async function fetchCampaignData() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const loadingDiv = document.getElementById('loading');

    if (loadingDiv) loadingDiv.style.display = 'block';

    try {
        const response = await fetch(
            `${BASE_URL}/performance-report-campaign?startDate=${startDate}&endDate=${endDate}`,
            { 
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to retrieve campaign data.');
        }

        const result = await response.json();

        if (!result.data || !result.data.items || result.data.items.length === 0) {
            throw new Error('No campaign data available');
        }

        populateCampaignTable(result.data.items);
    } catch (error) {
        Toast.show(error.message, 'error');
        const campaignTableBody = document.getElementById('campaignTableBody');
        if (campaignTableBody) {
            campaignTableBody.innerHTML = `
                <div class="empty-campaign-state">
                    <span class="material-icons-sharp">campaign</span>
                    <h3>No Campaigns Found</h3>
                    <p>Create your first campaign to start driving traffic</p>
                    <button class="create-campaign-btn" onclick="showTab('newCampaign')">
                        <span class="material-icons-sharp">add</span>
                        Create Campaign
                    </button>
                </div>
            `;
        }
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}

function populateCampaignTable(campaigns) {
    const tableBody = document.getElementById('campaignTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    campaigns.forEach(campaign => {
        const impressions = parseInt(campaign.impressions || 0);
        const clicks = parseInt(campaign.clicks || 0);
        const conversions = parseInt(campaign.conversions || 0);
        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
        const cpm = parseFloat(campaign.cpm || 0).toFixed(2);
        const spent = parseFloat(campaign.spent || 0).toFixed(2);
        const i2c = parseFloat(campaign.i2c || 0).toFixed(3);

        const card = document.createElement('div');
        card.className = 'campaign-row';
        
        card.innerHTML = `
            <div class="campaign-cell campaign-name-cell">
                <div class="campaign-title">${campaign.campaign || 'Untitled Campaign'}</div>
                <div class="campaign-meta">
                    <span class="meta-badge">${campaign.device || 'N/A'}</span>
                    <span class="meta-badge">${campaign.trafficType || 'N/A'}</span>
                    <span class="meta-badge">${campaign.adUnit || 'N/A'}</span>
                </div>
            </div>
            <div class="campaign-cell">
                <span class="status-badge ${(campaign.status || 'pending').toLowerCase()}">
                    ${campaign.status || 'PENDING'}
                </span>
            </div>
            <div class="campaign-cell metric-cell">
                <div class="metric-value">${impressions.toLocaleString()}</div>
                <div class="metric-label">Impressions</div>
            </div>
            <div class="campaign-cell metric-cell">
                <div class="metric-value">${conversions.toLocaleString()}</div>
                <div class="metric-label">Conversions</div>
            </div>
            <div class="campaign-cell metric-cell">
                <div class="metric-value">${clicks.toLocaleString()}</div>
                <div class="metric-label">Clicks</div>
            </div>
            <div class="campaign-cell metric-cell">
                <div class="metric-value metric-highlight">${ctr}%</div>
                <div class="metric-label">CTR</div>
            </div>
            <div class="campaign-cell metric-cell">
                <div class="metric-value">$${cpm}</div>
                <div class="metric-label">CPM</div>
            </div>
            <div class="campaign-cell metric-cell">
                <div class="metric-value metric-spent">$${spent}</div>
                <div class="metric-label">Spent</div>
            </div>
            <div class="campaign-cell actions-cell">
                <button class="action-icon-btn" onclick="viewCampaign('${campaign.id || ''}')" title="View">
                    <span class="material-icons-sharp">visibility</span>
                </button>
                <button class="action-icon-btn" onclick="editCampaign('${campaign.id || ''}')" title="Edit">
                    <span class="material-icons-sharp">edit</span>
                </button>
                <button class="action-icon-btn delete" onclick="deleteCampaign('${campaign.id || ''}')" title="Delete">
                    <span class="material-icons-sharp">delete</span>
                </button>
            </div>
        `;

        tableBody.appendChild(card);
    });
}

// Placeholder functions for actions
function viewCampaign(id) {
    console.log('View campaign:', id);
    Toast.show('Campaign details coming soon!', 'info');
}

function editCampaign(id) {
    console.log('Edit campaign:', id);
    Toast.show('Edit functionality coming soon!', 'info');
}

function deleteCampaign(id) {
    if (confirm('Are you sure you want to delete this campaign?')) {
        console.log('Delete campaign:', id);
        Toast.show('Delete functionality coming soon!', 'warning');
    }
}

// Export functions for use in dashboard.js
window.campaignModule = {
    fetchCampaignData,
    populateCampaignTable
};