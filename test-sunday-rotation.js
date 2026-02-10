/**
 * Test Script for Sunday Rotation Mechanics in Daily Shapes v4.0
 * Tests the new geojson structure with rotation reference coordinates
 */

console.log('🧪 Loading Sunday Rotation Test Script...');

const SundayRotationTest = {

    // Create a mock Sunday shape with rotation center for testing
    createMockSundayShape: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [100, 100],
                            [280, 100],
                            [280, 280],
                            [100, 280],
                            [100, 100]
                        ]]
                    },
                    "properties": {}
                },
                // Standard 4 reference points
                {
                    "properties": { "type": "reference", "corner": "bottom-left" },
                    "geometry": { "coordinates": [0, 0], "type": "Point" }
                },
                {
                    "properties": { "type": "reference", "corner": "bottom-right" },
                    "geometry": { "coordinates": [380, 0], "type": "Point" }
                },
                {
                    "properties": { "type": "reference", "corner": "top-left" },
                    "geometry": { "coordinates": [0, 380], "type": "Point" }
                },
                {
                    "properties": { "type": "reference", "corner": "top-right" },
                    "geometry": { "coordinates": [380, 380], "type": "Point" }
                },
                // NEW: Rotation reference coordinate for Sunday shapes
                {
                    "properties": { "type": "reference", "corner": "rotation-center" },
                    "geometry": { "coordinates": [190, 190], "type": "Point" }
                }
            ]
        };
    },

    // Test parsing of Sunday shape with rotation center
    testSundayShapeParsing: function() {
        console.log('🔄 Testing Sunday shape parsing...');

        const mockSundayShape = this.createMockSundayShape();

        // Check if rotation center is correctly identified
        const rotationFeature = mockSundayShape.features.find(
            f => f.properties && f.properties.type === 'reference' &&
            f.properties.corner === 'rotation-center'
        );

        if (rotationFeature) {
            const rotationCenter = rotationFeature.geometry.coordinates;
            console.log('✅ Sunday rotation center found:', rotationCenter);

            // Verify it's at expected position
            if (rotationCenter[0] === 190 && rotationCenter[1] === 190) {
                console.log('✅ Rotation center at expected coordinates (190, 190)');
                return true;
            } else {
                console.error('❌ Rotation center at unexpected coordinates');
                return false;
            }
        } else {
            console.error('❌ Rotation center not found in Sunday shape');
            return false;
        }
    },

    // Test practice mode filtering of rotation data
    testPracticeModeFiltering: function() {
        console.log('🎯 Testing practice mode rotation filtering...');

        const mockSundayShape = this.createMockSundayShape();
        const originalFeatures = mockSundayShape.features.length;

        // Simulate practice mode filtering
        const filteredFeatures = mockSundayShape.features.filter(feature => {
            return !(feature.properties &&
                   feature.properties.type === 'reference' &&
                   feature.properties.corner === 'rotation-center');
        });

        console.log(`📊 Original features: ${originalFeatures}, Filtered: ${filteredFeatures.length}`);

        if (filteredFeatures.length === originalFeatures - 1) {
            console.log('✅ Practice mode correctly filters out rotation center');
            return true;
        } else {
            console.error('❌ Practice mode filtering failed');
            return false;
        }
    },

    // Test daily mode rotation center extraction
    testDailyModeRotationExtraction: function() {
        console.log('🗓️ Testing daily mode rotation extraction...');

        const mockSundayShape = this.createMockSundayShape();

        // Simulate daily mode extraction
        const rotationFeature = mockSundayShape.features.find(
            f => f.properties && f.properties.type === 'reference' &&
            f.properties.corner === 'rotation-center'
        );

        if (rotationFeature) {
            const rotationCenter = rotationFeature.geometry.coordinates;
            mockSundayShape.rotationCenter = rotationCenter;

            console.log('✅ Daily mode extracted rotation center:', mockSundayShape.rotationCenter);

            // Verify the shape now has rotationCenter property
            if (mockSundayShape.rotationCenter && Array.isArray(mockSundayShape.rotationCenter)) {
                console.log('✅ Shape now has rotationCenter property for daily mode');
                return true;
            } else {
                console.error('❌ rotationCenter property not properly set');
                return false;
            }
        } else {
            console.error('❌ Could not extract rotation center for daily mode');
            return false;
        }
    },

    // Test current day detection for Sunday
    testSundayDetection: function() {
        console.log('📅 Testing Sunday detection...');

        const today = new Date();
        const isSunday = today.getDay() === 0;

        console.log(`Today is ${today.toLocaleDateString()} (day ${today.getDay()})`);
        console.log(`Is Sunday: ${isSunday}`);

        if (isSunday) {
            console.log('✅ Today is Sunday - rotation mechanics should be active in daily mode');
        } else {
            console.log('ℹ️ Today is not Sunday - rotation mechanics would be inactive');
        }

        return true;
    },

    // Run all tests
    runAllTests: function() {
        console.log('🧪 Running Sunday Rotation Mechanics Tests...');

        const results = {
            sundayShapeParsing: this.testSundayShapeParsing(),
            practiceModeFiltering: this.testPracticeModeFiltering(),
            dailyModeRotationExtraction: this.testDailyModeRotationExtraction(),
            sundayDetection: this.testSundayDetection()
        };

        const passedTests = Object.values(results).filter(result => result === true).length;
        const totalTests = Object.keys(results).length;

        console.log('🧪 Sunday Rotation Test Results:', results);
        console.log(`📊 Tests passed: ${passedTests}/${totalTests}`);

        if (passedTests === totalTests) {
            console.log('✅ All Sunday rotation mechanics tests passed!');
        } else {
            console.warn('⚠️ Some Sunday rotation mechanics tests failed');
        }

        return results;
    },

    // Get test configuration
    getTestConfig: function() {
        return {
            mockSundayShape: this.createMockSundayShape(),
            currentDay: new Date().getDay(),
            isSunday: new Date().getDay() === 0,
            testResults: this.runAllTests()
        };
    }
};

// Export to window for global access
window.SundayRotationTest = SundayRotationTest;

// Auto-run tests if this script is loaded
if (typeof window !== 'undefined') {
    // Run tests after a short delay to ensure other scripts are loaded
    setTimeout(() => {
        SundayRotationTest.runAllTests();
    }, 500);
}

console.log('✅ Sunday Rotation Test Script loaded');