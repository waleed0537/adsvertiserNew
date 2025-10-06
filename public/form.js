document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('campaignForm');
  const selectedCountries = new Set();

  if (!form) {
      console.error('Form element not found.');
      return;
  }

  // Handle Ad Unit button selection
  const adUnitButtons = document.querySelectorAll('.ad-unit-btn');
  const adUnitInput = document.getElementById('ad-unit');

  adUnitButtons.forEach(button => {
      button.addEventListener('click', (e) => {
          e.preventDefault(); // Prevent form submission
          // Remove active class from all buttons
          adUnitButtons.forEach(btn => btn.classList.remove('active'));
          // Add active class to clicked button
          button.classList.add('active');
          // Set the hidden input value
          if (adUnitInput) {
              adUnitInput.value = button.dataset.value;
          }
          console.log('Ad unit selected:', button.dataset.value);
      });
  });

  // Handle country selection
  const countryOptions = document.querySelectorAll('.country-option');
  const selectedCountriesContainer = document.querySelector('.selected-countries');

  if (!selectedCountriesContainer) {
      console.warn('Selected countries container not found');
  }

  countryOptions.forEach(option => {
      option.addEventListener('click', (e) => {
          e.preventDefault();
          const countryCode = option.dataset.value;
          const countryName = option.textContent.trim();

          if (!countryCode || !countryName) {
              console.error('Missing country data:', option);
              return;
          }

          if (selectedCountries.has(countryCode)) {
              // Remove country
              selectedCountries.delete(countryCode);
              const elementToRemove = selectedCountriesContainer?.querySelector(`[data-value="${countryCode}"]`);
              if (elementToRemove) elementToRemove.remove();
              option.classList.remove('selected');
              console.log('Country removed:', countryName);
          } else {
              // Add country
              selectedCountries.add(countryCode);
              if (selectedCountriesContainer) {
                  const countryElement = document.createElement('div');
                  countryElement.className = 'selected-country';
                  countryElement.dataset.value = countryCode;
                  countryElement.innerHTML = `
                      ${countryName}
                      <span class="remove-country">&times;</span>
                  `;
                  selectedCountriesContainer.appendChild(countryElement);

                  // Add remove functionality
                  countryElement.querySelector('.remove-country').addEventListener('click', (e) => {
                      e.stopPropagation();
                      selectedCountries.delete(countryCode);
                      countryElement.remove();
                      option.classList.remove('selected');
                      console.log('Country removed via X:', countryName);
                  });
              }
              option.classList.add('selected');
              console.log('Country added:', countryName);
          }
          console.log('Selected countries:', Array.from(selectedCountries));
      });
  });

  // Handle country search
  const searchInput = document.getElementById('country-search');
  if (searchInput) {
      searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          countryOptions.forEach(option => {
              const countryName = option.textContent.toLowerCase();
              option.style.display = countryName.includes(searchTerm) ? 'block' : 'none';
          });
      });
  }

  // Form validation helper
  function validateForm(formData) {
      const errors = [];

      if (!formData.campaignName?.trim()) {
          errors.push('Campaign name is required');
      }

      if (!formData.deviceFormat) {
          errors.push('Device format is required');
      }

      if (!formData.trafficType) {
          errors.push('Traffic type is required');
      }

      if (!formData.connectionType) {
          errors.push('Connection type is required');
      }

      if (!formData.adUnit) {
          errors.push('Ad unit is required');
      }

      if (!formData.pricingType) {
          errors.push('Pricing type is required');
      }

      if (!formData.landingUrl?.trim()) {
          errors.push('Landing URL is required');
      } else {
          // Basic URL validation
          try {
              new URL(formData.landingUrl);
          } catch (e) {
              errors.push('Please enter a valid URL for landing page');
          }
      }

      if (!formData.countries || formData.countries.length === 0) {
          errors.push('At least one country must be selected');
      }

      if (!formData.price || formData.price <= 0) {
          errors.push('Price must be greater than 0');
      }

      return errors;
  }

  // Enhanced getValue function
  const getValue = (id) => {
      const element = document.getElementById(id);
      if (!element) {
          console.warn(`Element with id '${id}' not found`);
          return null;
      }
      return element.value?.trim() || null;
  };

  const getCheckedValue = (name) => {
      const element = document.querySelector(`input[name="${name}"]:checked`);
      return element ? element.value : null;
  };

  // Form submission handler
  form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      console.log('Form submission started');

      // Show loading state
      const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
      const originalText = submitButton ? submitButton.textContent : '';
      if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Creating Campaign...';
      }

      try {
          // Create formData object
          const formData = {
              campaignName: getValue('campaign-name'),
              deviceFormat: getValue('device-format'),
              trafficType: getValue('traffic-type'),
              connectionType: getValue('connection-type'),
              adUnit: getValue('ad-unit'),
              pricingType: getCheckedValue('pricing-type'),
              landingUrl: getValue('landing-url'),
              countries: Array.from(selectedCountries),
              price: parseFloat(getValue('budget')) || 0,
              schedule: getCheckedValue('schedule') || 'start-once-verified',
              blacklistWhitelist: getValue('blacklist-whitelist')?.split('\n').filter(id => id.trim()) || [],
              ipRanges: getValue('ip-range')?.split('\n').filter(range => range.trim()) || []
          };

          console.log('Form data prepared:', formData);

          // Validate form data
          const validationErrors = validateForm(formData);
          if (validationErrors.length > 0) {
              throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
          }

          // Determine base URL
          const baseUrl = window.location.hostname === 'localhost' 
              ? 'http://localhost:3002'
              : 'https://adsvertiser.com';

          console.log('Sending request to:', `${baseUrl}/api/campaigns`);

          const response = await fetch(`${baseUrl}/api/campaigns`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify(formData)
          });

          console.log('Response received:', response.status, response.statusText);

          // Handle response
          let data;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
              data = await response.json();
          } else {
              const text = await response.text();
              console.error('Non-JSON response:', text);
              throw new Error('Server returned invalid response');
          }

          console.log('Response data:', data);

          if (response.ok && data.success) {
              // Success
              if (window.Toast) {
                  Toast.show("Campaign created successfully!", 'success');
              } else {
                  alert("Campaign created successfully!");
              }

              // Reset form
              form.reset();
              selectedCountries.clear();
              if (selectedCountriesContainer) {
                  selectedCountriesContainer.innerHTML = '';
              }
              adUnitButtons.forEach(btn => btn.classList.remove('active'));
              countryOptions.forEach(option => option.classList.remove('selected'));
              
              // Navigate to campaign tab if function exists
              if (typeof showTab === 'function') {
                  setTimeout(() => showTab('campaign'), 1000);
              }
          } else {
              // Error from server
              throw new Error(data.message || data.error || 'Failed to create campaign');
          }

      } catch (error) {
          console.error('Campaign creation error:', error);
          
          let errorMessage = 'Error creating campaign';
          if (error.message) {
              errorMessage += ': ' + error.message;
          }

          if (window.Toast) {
              Toast.show(errorMessage, 'error');
          } else {
              alert(errorMessage);
          }

          // Handle authentication errors
          if (error.message.includes('Authentication') || error.message.includes('unauthorized')) {
              setTimeout(() => {
                  window.location.href = '/login';
              }, 2000);
          }
      } finally {
          // Reset button state
          if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = originalText || 'Create Campaign';
          }
      }
  });

  // Debug: Log form elements on page load
  console.log('Campaign form initialized');
  console.log('Form elements found:', {
      form: !!form,
      adUnitButtons: adUnitButtons.length,
      countryOptions: countryOptions.length,
      selectedCountriesContainer: !!selectedCountriesContainer,
      searchInput: !!searchInput
  });
});