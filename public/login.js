// Login and Signup functionality
document.addEventListener('DOMContentLoaded', function() {
    const sign_in_btn = document.querySelector("#sign-in-btn");
    const sign_up_btn = document.querySelector("#sign-up-btn");
    const container = document.querySelector(".container");

    // Panel switching functionality
    if (sign_up_btn) {
        sign_up_btn.addEventListener("click", () => {
            container.classList.add("sign-up-mode");
        });
    }

    if (sign_in_btn) {
        sign_in_btn.addEventListener("click", () => {
            container.classList.remove("sign-up-mode");
        });
    }

    // Determine base URL
    const getBaseUrl = () => {
        return window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : 'https://adsvertisernew-1.onrender.com';
    };

    // Enhanced error display function
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
        console.error('Error:', message);
    }

    function showSuccess(message) {
        if (window.Toast) {
            Toast.show(message, 'success');
        } else {
            alert(message);
        }
    }

    // Login form handler
    const loginForm = document.querySelector('.sign-in-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = loginForm.querySelector('input[name="email"]')?.value?.trim();
            const password = loginForm.querySelector('input[name="password"]')?.value;
            const submitButton = loginForm.querySelector('input[type="submit"]');

            // Clear previous errors
            const errorElement = document.getElementById('login-error');
            if (errorElement) {
                errorElement.style.display = 'none';
            }

            // Basic validation
            if (!email || !password) {
                showError('login-error', 'Please fill in all fields');
                return;
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('login-error', 'Please enter a valid email address');
                return;
            }

            // Show loading state
            const originalValue = submitButton ? submitButton.value : '';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.value = 'Logging in...';
            }

            try {
                console.log('Attempting login for:', email);
                
                const response = await fetch(`${getBaseUrl()}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });

                console.log('Login response status:', response.status);

                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('Failed to parse response as JSON');
                    throw new Error('Server returned invalid response');
                }

                console.log('Login response data:', data);

                if (response.ok && data.success) {
                    showSuccess('Login successful! Redirecting...');
                    setTimeout(() => {
                        window.location.href = data.redirectUrl || '/dashboard.html';
                    }, 1000);
                } else {
                    const errorMessage = data.message || data.error || 'Login failed';
                    showError('login-error', errorMessage);
                }

            } catch (error) {
                console.error('Login error:', error);
                showError('login-error', 'Network error. Please try again.');
            } finally {
                // Reset button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.value = originalValue;
                }
            }
        });
    }

    // Signup form handler
    const signupForm = document.querySelector('.sign-up-form');
    if (signupForm) {
        // Real-time validation for email and username
        const emailInput = signupForm.querySelector('input[name="email"]');
        const usernameInput = signupForm.querySelector('input[name="username"]');
        
        let validationTimeout;

        const checkUserAvailability = async (email, username) => {
            try {
                const response = await fetch(`${getBaseUrl()}/check-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, username })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    showError('signup-error', data.error || 'User check failed');
                    return false;
                }
                return true;
            } catch (error) {
                console.error('User check error:', error);
                return false;
            }
        };

        // Debounced validation
        const debouncedCheck = (email, username) => {
            clearTimeout(validationTimeout);
            validationTimeout = setTimeout(() => {
                if (email && username) {
                    checkUserAvailability(email, username);
                }
            }, 500);
        };

        if (emailInput && usernameInput) {
            emailInput.addEventListener('blur', () => {
                const email = emailInput.value.trim();
                const username = usernameInput.value.trim();
                if (email && username) {
                    debouncedCheck(email, username);
                }
            });

            usernameInput.addEventListener('blur', () => {
                const email = emailInput.value.trim();
                const username = usernameInput.value.trim();
                if (email && username) {
                    debouncedCheck(email, username);
                }
            });
        }

        // Signup form submission
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = signupForm.querySelector('input[name="username"]')?.value?.trim();
            const email = signupForm.querySelector('input[name="email"]')?.value?.trim();
            const password = signupForm.querySelector('input[name="password"]')?.value;
            const password2 = signupForm.querySelector('input[name="password2"]')?.value;
            const submitButton = signupForm.querySelector('input[type="submit"]');

            // Clear previous errors
            const errorElement = document.getElementById('signup-error');
            if (errorElement) {
                errorElement.style.display = 'none';
            }

            // Validation
            if (!username || !email || !password || !password2) {
                showError('signup-error', 'Please fill in all fields');
                return;
            }

            if (username.length < 3) {
                showError('signup-error', 'Username must be at least 3 characters long');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('signup-error', 'Please enter a valid email address');
                return;
            }

            if (password.length < 6) {
                showError('signup-error', 'Password must be at least 6 characters long');
                return;
            }

            if (password !== password2) {
                showError('signup-error', 'Passwords do not match');
                return;
            }

            // Show loading state
            const originalValue = submitButton ? submitButton.value : '';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.value = 'Creating Account...';
            }

            try {
                console.log('Attempting signup for:', email);
                
                const response = await fetch(`${getBaseUrl()}/signup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ username, email, password, password2 })
                });

                console.log('Signup response status:', response.status);

                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('Failed to parse response as JSON');
                    throw new Error('Server returned invalid response');
                }

                console.log('Signup response data:', data);

                if (response.ok && data.success) {
                    showSuccess('Account created successfully! You can now log in.');
                    
                    // Clear form
                    signupForm.reset();
                    
                    // Switch to login form
                    setTimeout(() => {
                        container.classList.remove("sign-up-mode");
                    }, 2000);
                } else {
                    const errorMessage = data.message || data.error || 'Signup failed';
                    showError('signup-error', errorMessage);
                }

            } catch (error) {
                console.error('Signup error:', error);
                showError('signup-error', 'Network error. Please try again.');
            } finally {
                // Reset button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.value = originalValue;
                }
            }
        });
    }

    console.log('Login/Signup handlers initialized');
});

// Simple authentication check for dashboard pages
document.addEventListener('DOMContentLoaded', async function() {
    // Only check auth on dashboard pages
    if (window.location.pathname.includes('dashboard')) {
        try {
            const response = await fetch('/session-status', {
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
                    window.location.href = '/login';
                    return;
                }
                
                console.log('User authenticated successfully');
            } else {
                console.log('Session check failed, redirecting to login');
                window.location.href = '/login';
                return;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login';
            return;
        }
    }
});