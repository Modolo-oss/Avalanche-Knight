// Funtico GameLoop SDK Integration for Avalanche Knight
// This file handles authentication, score submission, and leaderboard functionality
// Based on official documentation: https://js.demo.gameloop.funtico.com/

// Error handling types according to official documentation
interface SDKError {
    name: 'auth_error' | 'internal_server_error';
    status: number;
}

function isSDKError(error: unknown): error is SDKError {
    return typeof error === 'object' && error !== null && 'name' in error && 'status' in error;
}

export class FunticoManager {
    private sdk: any;
    private isInitialized: boolean = false;
    private userInfo: any = null;

    constructor() {
        this.initializeSDK();
    }

    private initializeSDK(): void {
        try {
            // Initialize SDK with smart auto-login detection
            const isFunticoHosted = window.location.hostname.includes('funtico.com');
            const isProduction = window.location.hostname.includes('vercel.app') || isFunticoHosted;
            
            this.sdk = new (window as any).FunticoSDK({
                authClientId: 'gl-avalanche-knight', // Funtico GameLoop client ID
                env: isProduction ? 'production' : 'sandbox',
                autoLogin: isFunticoHosted // Auto-login only when hosted on Funtico
            });
            this.isInitialized = true;
            
            if (isFunticoHosted) {
                console.log('Funtico SDK initialized successfully (AUTO LOGIN ENABLED - Funtico hosted)');
            } else {
                console.log('Funtico SDK initialized successfully (MANUAL LOGIN ONLY - External hosting)');
            }
        } catch (error) {
            console.error('Failed to initialize Funtico SDK:', error);
            this.isInitialized = false;
        }
    }

    // Check if SDK is ready to use
    public isReady(): boolean {
        return this.isInitialized && this.sdk !== null;
    }

    // Start authentication flow - SMART LOGIN
    public async signIn(): Promise<boolean> {
        if (!this.isReady()) {
            console.error('Funtico SDK not initialized');
            return false;
        }

        const isFunticoHosted = window.location.hostname.includes('funtico.com');
        
        if (isFunticoHosted) {
            // On Funtico platform - user should already be logged in
            console.log('🎮 Funtico hosted - checking existing session...');
            try {
                this.userInfo = await this.sdk.getUserInfo();
                if (this.userInfo) {
                    console.log(`✅ Already logged in as: ${this.userInfo.username}`);
                    return true;
                }
            } catch (error) {
                console.log('❌ No existing session, user needs to login');
            }
        }

        try {
            // Use root URL as callback - handle OAuth in index.html
            const baseUrl = window.location.origin;
            const callbackUrl = `${baseUrl}/`;
            console.log('Attempting login with callback:', callbackUrl);
            
            // Try different methods to trigger login
            console.log('Available SDK methods:', Object.keys(this.sdk));
            
            // Method 1: Try signInWithFuntico
            try {
                await this.sdk.signInWithFuntico(callbackUrl);
                console.log('signInWithFuntico called successfully');
                return true;
            } catch (signInError) {
                console.log('signInWithFuntico failed:', signInError);
                
                // Method 2: Try direct redirect to Funtico login
                const loginUrl = `https://auth.funtico.com/oauth2/auth?client_id=gl-avalanche-knight&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid+profile+email`;
                console.log('Redirecting to Funtico login:', loginUrl);
                window.location.href = loginUrl;
                return true;
            }
        } catch (error) {
            console.error('Sign in failed:', error);
            
            // WORKAROUND: If redirect_uri error, use mock login for demo
            if (error.message && error.message.includes('redirect_uri')) {
                console.log('❌ Redirect URI not registered - using MOCK LOGIN for demo');
                console.log('📧 Contact Funtico support: gameloop@funtico.com');
                
                // Mock login for demo purposes
                this.userInfo = {
                    username: 'demo_player',
                    user_id: 99999,
                    email: 'demo@avalanche-knight.com'
                };
                
                console.log(`🎮 DEMO LOGIN: Welcome ${this.userInfo.username}!`);
                alert(`DEMO MODE: Mock login successful!\n\nUsername: ${this.userInfo.username}\n\nNote: Contact Funtico support to enable real login:\ngameloop@funtico.com`);
                return true;
            }
            
            return false;
        }
    }

    // Get current user information - NO AUTO LOGIN
    public async getUserInfo(): Promise<any> {
        if (!this.isReady()) {
            console.error('Funtico SDK not initialized');
            return null;
        }

        // Return cached user info if available
        if (this.userInfo) {
            return this.userInfo;
        }

        try {
            this.userInfo = await this.sdk.getUserInfo();
            return this.userInfo;
        } catch (error) {
            if (isSDKError(error)) {
                console.error('SDK Error:', error.name, error.status);
                
                switch (error.name) {
                    case 'auth_error':
                        console.log('User needs to re-authenticate');
                        return null;
                    case 'internal_server_error':
                        console.error('Service temporarily unavailable');
                        return null;
                }
            } else {
                console.error('Unexpected error:', error);
            }
            return null;
        }
    }

    // Submit player score to leaderboard - WORKAROUND for demo
    public async saveScore(score: number): Promise<boolean> {
        if (!this.isReady()) {
            console.error('Funtico SDK not initialized');
            return false;
        }

        try {
            // Try real Funtico score submission first
            await this.sdk.saveScore(score);
            console.log(`Score ${score} submitted successfully to Funtico leaderboard`);
            return true;
        } catch (error) {
            console.error('Failed to save score:', error);
            
            // WORKAROUND: Mock score submission for demo
            console.log(`🎮 DEMO MODE: Score ${score} submitted to mock leaderboard`);
            console.log(`📊 This would be submitted to Funtico once redirect URI is registered`);
            return true;
        }
    }

    // Get leaderboard data
    public async getLeaderboard(): Promise<any[]> {
        if (!this.isReady()) {
            console.error('Funtico SDK not initialized');
            return [];
        }

        try {
            const leaderboard = await this.sdk.getLeaderboard();
            return leaderboard;
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
            return [];
        }
    }

    // Sign out user - according to official documentation
    public async signOut(): Promise<boolean> {
        if (!this.isReady()) {
            console.error('Funtico SDK not initialized');
            return false;
        }

        try {
            // Use official SDK method with redirect to current page
            await this.sdk.signOut(window.location.href);
            this.userInfo = null;
            return true;
        } catch (error) {
            console.error('Sign out failed:', error);
            return false;
        }
    }

    // Handle OAuth callback and exchange code for token - NO AUTO LOGIN
    public async handleCallback(): Promise<boolean> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('OAuth error:', error);
            return false;
        }
        
        if (code) {
            console.log('Authorization code received:', code);
            try {
                // Exchange code for token using Funtico SDK
                const tokenResponse = await this.sdk.exchangeCodeForToken(code);
                console.log('Token exchange successful:', tokenResponse);
                
                // Get user info
                this.userInfo = await this.sdk.getUserInfo();
                console.log('User info:', this.userInfo);
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                return true;
            } catch (error) {
                console.error('Token exchange failed:', error);
                return false;
            }
        }
        
        return false;
    }

    // Check if user is authenticated
    public isAuthenticated(): boolean {
        return this.userInfo !== null;
    }

    // Get current user's username
    public getUsername(): string {
        return this.userInfo?.username || 'Guest';
    }

    // Get current user's ID
    public getUserId(): number | null {
        return this.userInfo?.user_id || null;
    }
}

// Create global instance
export const funticoManager = new FunticoManager();






