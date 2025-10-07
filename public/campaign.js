        const API_ENDPOINTS = {
    local: 'http://localhost:3002',
    production: 'https://adsvertiser.com',  // or http://YOUR_SERVER_IP:3002
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
                <div class="campaign-card empty">
                    <p>No campaigns found. Create a new campaign to get started!</p>
                </div>
            `;
        }
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}
// Example of how to structure campaign cards in your JavaScript
// Add this structure to your campaign.js file

function createCampaignCard(campaign) {
    return `
        <div class="campaign-card">
            <div class="campaign-card-grid">
                <!-- Campaign Name Column -->
                <div class="campaign-name-cell">
                    <div class="name">${campaign.name}</div>
                    <div class="meta">
                        <div class="meta-item"><strong>Device:</strong> ${campaign.device}</div>
                        <div class="meta-item"><strong>Traffic Type:</strong> ${campaign.trafficType}</div>
                        <div class="meta-item"><strong>Ad Unit:</strong> ${campaign.adUnit}</div>
                        <div class="meta-item"><strong>Pricing:</strong> ${campaign.pricing}</div>
                        <div class="meta-item"><strong>Countries:</strong> ${campaign.countries}</div>
                        <div class="meta-item"><strong>Budget:</strong> $${campaign.budget}</div>
                        <div class="meta-item"><strong>Created:</strong> ${campaign.created}</div>
                    </div>
                </div>
                
                <!-- Status Column -->
                <div class="metric-value" data-label="Status">
                    <span class="status-badge ${campaign.status.toLowerCase()}">${campaign.status}</span>
                </div>
                
                <!-- Impressions Column -->
                <div class="metric-value" data-label="Impressions">
                    ${campaign.impressions.toLocaleString()}
                </div>
                
                <!-- Clicks Column -->
                <div class="metric-value" data-label="Clicks">
                    ${campaign.clicks.toLocaleString()}
                </div>
                
                <!-- CTR Column -->
                <div class="metric-value metric-highlight" data-label="CTR (%)">
                    ${campaign.ctr}%
                </div>
                
                <!-- CPM Column -->
                <div class="metric-value" data-label="CPM ($)">
                    $${campaign.cpm}
                </div>
                
                <!-- Spent Column -->
                <div class="metric-value metric-highlight" data-label="Spent ($)">
                    $${campaign.spent}
                </div>
                
                <!-- Actions Column -->
                <div class="campaign-actions" data-label="Actions">
                    <button class="action-btn edit" onclick="editCampaign('${campaign.id}')">View</button>
                    <button class="action-btn edit" onclick="editCampaign('${campaign.id}')">Edit</button>
                    <button class="action-btn delete" onclick="deleteCampaign('${campaign.id}')">Delete</button>
                </div>
            </div>
        </div>
    `;
}

// Example usage:
const campaignData = {
    id: '1',
    name: 'adshark',
    device: 'mobile',
    trafficType: 'mainstream',
    adUnit: 'native-banner',
    pricing: 'CPM',
    countries: 'CA, GB, DE +1 more',
    budget: '12',
    created: '07/10/2025',
    status: 'PENDING',
    impressions: 0,
    clicks: 0,
    ctr: '0.00',
    cpm: '0.00',
    spent: '0.00'
};

// Render campaign cards
document.getElementById('campaignTableBody').innerHTML = campaigns.map(campaign => 
    createCampaignCard(campaign)
).join('');
function populateCampaignTable(campaigns) {
    const tableBody = document.getElementById('campaignTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    campaigns.forEach(campaign => {
        const card = document.createElement('div');
        card.className = 'campaign-card';

        // Format numbers with proper precision
        const impressions = parseInt(campaign.impressions || 0).toLocaleString();
        const clicks = parseInt(campaign.clicks || 0).toLocaleString();
        const ctr = ((campaign.clicks / campaign.impressions) * 100 || 0).toFixed(2);
        const cpm = parseFloat(campaign.cpm || 0).toFixed(2);
        const spent = parseFloat(campaign.spent || 0).toFixed(2);
        const conversions = parseInt(campaign.conversions || 0).toLocaleString();
        const i2c = parseFloat(campaign.i2c || 0).toFixed(3);

        card.innerHTML = `
            <span>${campaign.campaign}</span>
            <span>${impressions}</span>
            <span>${conversions}</span>
            <span>${clicks}</span>
            <span>${ctr}%</span>
            <span>$${cpm}</span>
            <span>$${spent}</span>
            <span>${i2c}</span>
        `;

        tableBody.appendChild(card);
    });
}

// Export functions for use in dashboard.js
window.campaignModule = {
    fetchCampaignData,
    populateCampaignTable
};