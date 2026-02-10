/**
 * Shape Storage Module for Daily Shapes v4.0
 * Handles Supabase storage integration with proper naming conventions
 */

class ShapeStorage {
    constructor() {
        this.bucketName = 'shapes';
        this.cache = new Map();
        this.persistentCacheKey = 'dailyShapes_cache_v4';
        this.loadPersistentCache();
    }

    /**
     * Get Melbourne timezone date
     */
    getMelbourneDate() {
        const now = new Date();
        const melbourneTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"}));
        return melbourneTime;
    }

    /**
     * Format date to YYMMDD
     */
    formatDateToYYMMDD(date) {
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Check if date is Sunday (Melbourne time)
     */
    isSunday(date) {
        return date.getDay() === 0;
    }

    /**
     * Generate filename for a shape
     */
    generateFilename(date, shapeIndex) {
        const dateStr = this.formatDateToYYMMDD(date);
        const indexStr = String(shapeIndex).padStart(2, '0');
        return `${dateStr}-${indexStr}.geojson`;
    }

    /**
     * Load persistent cache from localStorage
     */
    loadPersistentCache() {
        try {
            const cached = localStorage.getItem(this.persistentCacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                // Only load cache entries from the last 7 days
                const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                Object.entries(data).forEach(([key, value]) => {
                    if (value.timestamp > sevenDaysAgo) {
                        this.cache.set(key, value);
                    }
                });
                console.log(`📦 Loaded ${this.cache.size} shapes from persistent cache`);
            }
        } catch (error) {
            console.warn('Failed to load persistent cache:', error);
        }
    }

    /**
     * Save cache to localStorage
     */
    savePersistentCache() {
        try {
            const cacheObj = {};
            this.cache.forEach((value, key) => {
                cacheObj[key] = value;
            });
            localStorage.setItem(this.persistentCacheKey, JSON.stringify(cacheObj));
        } catch (error) {
            console.warn('Failed to save persistent cache:', error);
        }
    }

    /**
     * Initialize Supabase client if needed
     */
    getSupabaseClient() {
        // Check for existing v4.0 client
        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        // Check for initialized SupabaseConfig client
        if (window.SupabaseConfig && window.SupabaseConfig.client) {
            return window.SupabaseConfig.client;
        }

        // Try to create client if Supabase library is available
        if (window.supabase && window.SupabaseConfig) {
            const { createClient } = window.supabase;
            const client = createClient(
                window.SupabaseConfig.url,
                window.SupabaseConfig.anonKey
            );
            window.SupabaseConfig.client = client;
            return client;
        }

        return null;
    }

    /**
     * Load a single shape from Supabase with retries
     */
    async loadShape(filename, retries = 3) {
        // Check memory cache first
        if (this.cache.has(filename)) {
            const cached = this.cache.get(filename);
            console.log(`💾 Using cached shape: ${filename}`);
            return cached.data;
        }

        const client = this.getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not available');
        }

        let lastError;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`📥 Downloading shape: ${filename} (attempt ${attempt}/${retries})`);

                // Try to get public URL first
                const { data: publicUrlData } = client.storage
                    .from(this.bucketName)
                    .getPublicUrl(filename);

                let response;
                if (publicUrlData && publicUrlData.publicUrl) {
                    // Use public URL with cache busting
                    const url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
                    response = await fetch(url, {
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } else {
                    // Fallback to download method
                    const { data, error } = await client.storage
                        .from(this.bucketName)
                        .download(filename);

                    if (error) {
                        throw error;
                    }

                    response = new Response(data);
                }

                // Parse the GeoJSON
                const text = await response.text();
                const geoJson = JSON.parse(text);

                // Validate GeoJSON structure
                if (!geoJson.type || !geoJson.features) {
                    throw new Error('Invalid GeoJSON structure');
                }

                // Cache the shape
                const cacheEntry = {
                    data: geoJson,
                    timestamp: Date.now()
                };
                this.cache.set(filename, cacheEntry);
                this.savePersistentCache();

                console.log(`✅ Successfully loaded shape: ${filename}`);
                return geoJson;

            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt} failed for ${filename}:`, error.message);

                if (attempt < retries) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }

        console.error(`Failed to load shape ${filename} after ${retries} attempts:`, lastError);
        throw lastError;
    }

    /**
     * Preload all shapes for a given date (Daily Mode)
     */
    async preloadDailyShapes(date) {
        const shapes = [];
        const errors = [];

        console.log(`🔄 Preloading shapes for ${this.formatDateToYYMMDD(date)}...`);

        // Load all 3 shapes in parallel
        const promises = [1, 2, 3].map(async (index) => {
            const filename = this.generateFilename(date, index);
            try {
                const shape = await this.loadShape(filename);
                shapes[index - 1] = shape;
                console.log(`✅ Loaded shape ${index}: ${filename}`);
            } catch (error) {
                errors.push({ index, filename, error });
                console.warn(`⚠️ Failed to load shape ${index}: ${filename}`);
            }
        });

        await Promise.all(promises);

        // Handle Sunday rotation reference
        const isSunday = this.isSunday(date);
        if (isSunday) {
            console.log('🔄 Sunday detected - rotation enabled for Daily Mode');
            shapes.forEach((shape, index) => {
                if (shape && shape.properties) {
                    // Ensure rotationRef exists for Sunday shapes
                    if (!shape.properties.rotationRef) {
                        console.warn(`Shape ${index + 1} missing rotationRef for Sunday`);
                    }
                }
            });
        }

        return {
            shapes,
            errors,
            isSunday,
            date: this.formatDateToYYMMDD(date)
        };
    }

    /**
     * Load shape by date string and shape number (for discovery)
     */
    async loadShapeByDateStr(dateStr, shapeNumber) {
        const fileName = `${dateStr}-${String(shapeNumber).padStart(2, '0')}.geojson`;

        try {
            // Use Supabase storage
            const client = this.getSupabaseClient();
            if (!client) {
                throw new Error('Supabase client not available');
            }

            const { data, error } = await client.storage
                .from('shapes')
                .download(fileName);

            if (error) {
                throw new Error(`HTTP ${error.statusCode || 400}: ${error.message || ''}`);
            }

            if (!data) {
                throw new Error('No data received');
            }

            const text = await data.text();
            const shape = JSON.parse(text);

            console.log(`✅ Successfully loaded shape: ${fileName}`);
            return shape;

        } catch (error) {
            console.log(`❌ Shape not found: ${fileName}`);
            throw error;
        }
    }

    /**
     * Load a single shape on demand (Practice Mode)
     */
    async loadPracticeShape(date, shapeIndex) {
        const filename = this.generateFilename(date, shapeIndex);

        try {
            const shape = await this.loadShape(filename);

            // For Practice Mode, remove rotation reference even on Sundays
            if (shape && shape.properties && shape.properties.rotationRef) {
                console.log('📌 Practice Mode: Ignoring rotation reference');
                const cleanShape = JSON.parse(JSON.stringify(shape));
                delete cleanShape.properties.rotationRef;
                return cleanShape;
            }

            return shape;
        } catch (error) {
            console.error(`Failed to load practice shape: ${filename}`, error);
            throw error;
        }
    }

    /**
     * Get yesterday's date in Melbourne timezone
     */
    getYesterdayMelbourne() {
        const melbourne = this.getMelbourneDate();
        melbourne.setDate(melbourne.getDate() - 1);
        return melbourne;
    }

    /**
     * Get available practice dates (yesterday and older)
     */
    getAvailablePracticeDates(limit = 30) {
        const dates = [];
        const melbourne = this.getMelbourneDate();

        // Start from 2 days ago to avoid spoiling shapes for different time zones
        for (let i = 2; i <= limit + 1; i++) {
            const practiceDate = new Date(melbourne);
            practiceDate.setDate(practiceDate.getDate() - i);
            dates.push({
                date: practiceDate,
                dateStr: this.formatDateToYYMMDD(practiceDate),
                isSunday: this.isSunday(practiceDate)
            });
        }

        return dates;
    }

    /**
     * Clear cache (for testing or manual reset)
     */
    clearCache() {
        this.cache.clear();
        localStorage.removeItem(this.persistentCacheKey);
        console.log('🗑️ Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
            memoryUsage: JSON.stringify(Array.from(this.cache.values())).length
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ShapeStorage = ShapeStorage;
}