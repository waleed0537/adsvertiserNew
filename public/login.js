document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Enhanced login handler
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(loginForm);
            const loginData = {
                email: formData.get('email')?.trim(),
                password: formData.get('password')
            };

            console.log('Attempting login for:', loginData.email);

            // Basic validation
            if (!loginData.email || !loginData.password) {
                showError('Please fill in all fields');
                return;
            }

            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Signing In...';
            submitButton.disabled = true;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include', // Important for sessions
                    body: JSON.stringify(loginData)
                });

                console.log('Login response status:', response.status);
                
                const result = await response.json();
                console.log('Login result:', result);

                if (result.success) {
                    showSuccess('Login successful! Redirecting...');
                    
                    // Small delay to show success message
                    setTimeout(() => {
                        window.location.href = result.redirectUrl || '/dashboard.html';
                    }, 1000);
                } else {
                    showError(result.message || 'Login failed');
                    
                    if (result.needsVerification) {
                        showError('Please check your email and verify your account first.');
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('Network error. Please check your connection and try again.');
            } finally {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // Enhanced signup handler
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(signupForm);
            const signupData = {
                username: formData.get('username')?.trim(),
                email: formData.get('email')?.trim(),
                password: formData.get('password'),
                password2: formData.get('password2')
            };

            console.log('Attempting signup for:', signupData.email);

            // Client-side validation
            if (!signupData.username || !signupData.email || !signupData.password || !signupData.password2) {
                showError('Please fill in all fields');
                return;
            }

            if (signupData.password !== signupData.password2) {
                showError('Passwords do not match');
                return;
            }

            if (signupData.password.length < 6) {
                showError('Password must be at least 6 characters long');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(signupData.email)) {
                showError('Please enter a valid email address');
                return;
            }

            const submitButton = signupForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Creating Account...';
            submitButton.disabled = true;

            try {
                // First check if user exists
                const checkResponse = await fetch('/check-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: signupData.email,
                        username: signupData.username
                    })
                });

                if (!checkResponse.ok) {
                    const checkResult = await checkResponse.json();
                    showError(checkResult.error || 'User already exists');
                    return;
                }

                // Proceed with signup
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(signupData)
                });

                console.log('Signup response status:', response.status);
                
                const result = await response.json();
                console.log('Signup result:', result);

                if (result.success) {
                    showSuccess('Account created successfully! Please check your email for verification.');
                    
                    // Clear form
                    signupForm.reset();
                    
                    // Redirect after delay
                    setTimeout(() => {
                        window.location.href = result.redirect || '/login.html?mode=signin';
                    }, 3000);
                } else {
                    showError(result.message || 'Registration failed');
                }
            } catch (error) {
                console.error('Signup error:', error);
                showError('Network error. Please check your connection and try again.');
            } finally {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // Helper functions for showing messages
    function showError(message) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            text-align: center;
        `;
        errorDiv.textContent = message;
        
        const form = document.querySelector('form');
        form.insertBefore(errorDiv, form.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => errorDiv.remove(), 5000);
    }

    function showSuccess(message) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());

        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background: #efe;
            border: 1px solid #cfc;
            color: #363;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            text-align: center;
        `;
        successDiv.textContent = message;
        
        const form = document.querySelector('form');
        form.insertBefore(successDiv, form.firstChild);
    }
});

// Enhanced dashboard.js modifications for production
const BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : 'https://adsvertisernew-1.onrender.com';

// Enhanced API call function with better error handling
async function apiCall(url, options = {}) {
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
        },
        ...options
    };

    console.log('Making API call to:', url);
    console.log('Options:', defaultOptions);

    try {
        const response = await fetch(url, defaultOptions);
        
        console.log('API Response status:', response.status);
        console.log('API Response headers:', [...response.headers.entries()]);

        // Handle different response types
        if (response.status === 401) {
            console.log('Session expired or not authenticated');
            
            // Clear any stored data
            localStorage.clear();
            sessionStorage.clear();
            
            // Show user-friendly message
            if (window.Toast) {
                Toast.show('Session expired. Please log in again.', 'error');
            }
            
            // Redirect to login
            setTimeout(() => {
                window.location.href = '/login.html?mode=signin';
            }, 1500);
            
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('API call failed:', error);
        
        // Handle network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            if (window.Toast) {
                Toast.show('Network error. Please check your connection.', 'error');
            }
        }
        
        throw error;
    }
}


document.addEventListener('DOMContentLoaded', async function() {
    // Only check auth on dashboard pages
    if (window.location.pathname.includes('dashboard')) {
        try {
            const response = await fetch('/session-debug', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const sessionInfo = await response.json();
                console.log('Session info:', sessionInfo);
                
                if (!sessionInfo.isAuthenticated) {
                    console.log('User not authenticated, redirecting to login');
                    window.location.href = '/login.html?mode=signin';
                    return;
                }
                
                console.log('User authenticated successfully');
            } else {
                console.log('Session check failed, redirecting to login');
                window.location.href = '/login.html?mode=signin';
                return;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login.html?mode=signin';
            return;
        }
    }
});