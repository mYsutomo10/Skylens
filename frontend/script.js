// SkyLens Air Quality Monitoring System - Real API Version

// ============== GLOBAL VARIABLES ==============
// API Base URL
const BASE_URL = 'http://108.137.79.240';

// Current selected location - Menggunakan bojongsoang sebagai default karena baleendah belum tersedia
let currentLocation = 'baleendah';

// Current time range for history chart
let currentTimeRange = '24h';

// Map object
let skylensMap = null;

// Chart objects
let aqiHistoryChart = null;
let aqiForecastChart = null;

// Cache untuk data historis
let historyCache = {
    '24h': { data: [], analysis: null, timestamp: 0, location: '' },
    '7d': { data: [], analysis: null, timestamp: 0, location: '' },
    '30d': { data: [], analysis: null, timestamp: 0, location: '' }
};

// Maps for each location
const locationCoordinates = {
    baleendah: { lat: -6.99932174153389, lng: 107.6215486121442 },
    bojongsoang: { lat: -6.972399937528917, lng: 107.63676808523401 }
};

// Map location names to API endpoints
const locationEndpoints = {
    baleendah: 'Baleendah',
    bojongsoang: 'Jalan Radio'
};

// Contoh berita untuk ditampilkan (ini bisa diganti dengan data dari API jika tersedia)
const newsItems = [
    {
        date: new Date(),
        title: 'Kualitas Udara Jakarta Memburuk Pasca Libur Panjang',
        content: 'Pemantauan menunjukkan peningkatan kadar PM2.5 hingga 40% dibandingkan minggu sebelumnya...'
    },
    {
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        title: 'Penggunaan Transportasi Umum Berhasil Turunkan Polusi Udara',
        content: 'Program car free day dan pengalihan ke transportasi umum terbukti efektif menurunkan kadar CO...'
    },
    {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        title: 'WHO Perbarui Ambang Batas Aman untuk PM2.5',
        content: 'Organisasi Kesehatan Dunia (WHO) memperketat standar kualitas udara global dengan menurunkan ambang batas...'
    }
];

// Cek apakah ada state tersimpan saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Ambil state yang tersimpan
    const savedLocation = localStorage.getItem('currentLocation');
    const savedPage = localStorage.getItem('currentPage');
    
    // Jika ada lokasi tersimpan, gunakan
    if (savedLocation && locationCoordinates[savedLocation]) {
        currentLocation = savedLocation;
    }
    
    // Jika ada halaman tersimpan, tampilkan
    if (savedPage) {
        // Sembunyikan semua halaman
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        
        // Tampilkan halaman yang disimpan
        const pageToShow = document.getElementById(savedPage + '-page');
        if (pageToShow) {
            pageToShow.classList.add('active');
            
            // Update juga navigasi
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            const navLink = document.querySelector(`.nav-link[data-page="${savedPage}"]`);
            if (navLink) navLink.classList.add('active');
            
            // Jika dashboard, perlu update data
            if (savedPage === 'dashboard') {
                fetchData().then(data => {
                    updateAqiDisplay(data);
                    updateParameterValues(data);
                    initAqiHistoryChart(data);
                    initAqiForecastChart(data);
                    initMap();
                });
            }
        }
    }
});

// ============== HELPER FUNCTIONS ==============

// Convert Firestore timestamp to JavaScript Date
function firestoreTimestampToDate(timestamp) {
    if (!timestamp) return new Date();
    if (timestamp._seconds) {
        return new Date(timestamp._seconds * 1000);
    }
    return new Date(timestamp);
}

// Format timestamp to time string (HH:MM)
function formatTime(timestamp) {
    const date = typeof timestamp === 'object' && timestamp._seconds ? 
        firestoreTimestampToDate(timestamp) : new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Format for 7 days (DD/MM)
function formatDay(timestamp) {
    const date = typeof timestamp === 'object' && timestamp._seconds ? 
        firestoreTimestampToDate(timestamp) : new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
}

// Format timestamp to full date string (DD Month YYYY)
function formatFullDate(timestamp) {
    const date = typeof timestamp === 'object' && timestamp._seconds ? 
        firestoreTimestampToDate(timestamp) : new Date(timestamp);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

// Get appropriate label format based on time range
function getTimeLabel(timestamp, range) {
    switch(range) {
        case '24h': return formatTime(timestamp);
        case '7d': return formatDay(timestamp);
        case '30d': return formatDay(timestamp);
        default: return formatTime(timestamp);
    }
}

// Get AQI status based on value - UPDATED THRESHOLDS
function getAqiStatus(value) {
    if (value <= 50) {
        return {
            category: 'Baik',
            color: '#00e400',
            emoji: '😊',
            description: 'Kualitas udara baik dan polusi udara dianggap memuaskan dengan risiko kesehatan yang kecil atau tidak ada.'
        };
    } else if (value <= 100) {
        return {
            category: 'Sedang',
            color: '#ffff00',
            emoji: '😐',
            description: 'Kualitas udara dapat diterima; namun, beberapa polutan mungkin menjadi perhatian sedang bagi sebagian kecil orang yang sangat sensitif terhadap polusi udara.'
        };
    } else if (value <= 150) {
        return {
            category: 'Tidak Sehat untuk Kelompok Sensitif',
            color: '#ff7e00',
            emoji: '😷',
            description: 'Kelompok sensitif mungkin mengalami efek kesehatan. Masyarakat umum tidak terlalu berisiko.'
        };
    } else if (value <= 200) {
        return {
            category: 'Tidak Sehat',
            color: '#ff0000',
            emoji: '🤢',
            description: 'Semua orang mungkin mulai mengalami efek kesehatan; anggota kelompok sensitif mungkin mengalami efek kesehatan yang lebih serius.'
        };
    } else if (value <= 300) {
        return {
            category: 'Sangat Tidak Sehat',
            color: '#8f3f97',
            emoji: '😵',
            description: 'Peringatan kesehatan kondisi darurat. Seluruh populasi lebih mungkin terpengaruh.'
        };
    } else {
        return {
            category: 'Berbahaya',
            color: '#000000',
            emoji: '☠️',
            description: 'Peringatan kesehatan: semua orang mungkin mengalami efek kesehatan yang lebih serius.'
        };
    }
}

// Get parameter status based on value and parameter type - UPDATED THRESHOLDS
function getParameterStatus(param, value) {
    // Threshold values updated as per requirements
    const thresholds = {
        'pm25': {
            good: 15,
            moderate: 55,
            sensitive: 150,
            unhealthy: 250,
            very_unhealthy: 350
        },
        'pm10': {
            good: 50,
            moderate: 150,
            sensitive: 250,
            unhealthy: 350,
            very_unhealthy: 420
        },
        'co': {
            good: 5000,
            moderate: 10000,
            sensitive: 17000,
            unhealthy: 34000,
            very_unhealthy: 46000
        },
        'ozone': {
            good: 100,
            moderate: 130,
            sensitive: 160,
            unhealthy: 200,
            very_unhealthy: 300
        },
        'no2': {
            good: 40,
            moderate: 80,
            sensitive: 180,
            unhealthy: 280,
            very_unhealthy: 400
        },
        'nh3': {
            good: 100,
            moderate: 200,
            sensitive: 300,
            unhealthy: 400,
            very_unhealthy: 600
        }
    };

    // Map parameter names to their corresponding threshold key
    const paramMap = {
        'pm25': 'pm25',
        'pm10': 'pm10',
        'co': 'co',
        'ozone': 'ozone',
        'no2': 'no2',
        'nh3': 'nh3'
    };

    const threshold = thresholds[paramMap[param]];
    
    if (!threshold) {
        return {
            status: 'Tidak Diketahui',
            color: '#999999',
            description: 'Data parameter tidak tersedia.'
        };
    }

    if (value <= threshold.good) {
        return {
            status: 'Baik',
            color: '#00e400',
            description: `Kadar ${param} berada pada level aman.`
        };
    } else if (value <= threshold.moderate) {
        return {
            status: 'Sedang',
            color: '#ffff00',
            description: `Kadar ${param} dapat diterima tetapi mungkin sedikit mempengaruhi beberapa orang yang sangat sensitif.`
        };
    } else if (value <= threshold.sensitive) {
        return {
            status: 'Tidak Sehat untuk Kelompok Sensitif',
            color: '#ff7e00',
            description: `Kelompok sensitif mungkin mengalami efek kesehatan dari tingkat ${param} saat ini.`
        };
    } else if (value <= threshold.unhealthy) {
        return {
            status: 'Tidak Sehat',
            color: '#ff0000',
            description: `Tingkat ${param} yang tinggi dapat mempengaruhi kesehatan setiap orang.`
        };
    } else if (value <= threshold.very_unhealthy) {
        return {
            status: 'Sangat Tidak Sehat',
            color: '#8f3f97',
            description: `Tingkat ${param} berbahaya dan dapat menyebabkan dampak kesehatan yang serius.`
        };
    } else {
        return {
            status: 'Berbahaya',
            color: '#000000',
            description: `Tingkat ${param} sangat berbahaya dan dapat menyebabkan efek kesehatan yang serius.`
        };
    }
}

// ============== API FUNCTIONS ==============

// Fetch current data from API
async function fetchCurrentData() {
    try {
        const endpoint = locationEndpoints[currentLocation];
        const url = `${BASE_URL}/${endpoint}`;
        
        console.log(`📡 Fetching current data from: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Current data received:', data);
        
        // Map to standardized format - using the updated structure from API
        return {
            timestamp: firestoreTimestampToDate(data.current?.timestamp || data.processed?.timestamp).getTime(),
            aqi: data.current?.aqi || data.processed?.aqi || 0,
            'pm2.5': data.current?.components?.pm2_5 || data.processed?.components?.pm2_5 || 0,
            'pm10': data.current?.components?.pm10 || data.processed?.components?.pm10 || 0,
            'co': data.current?.components?.co || data.processed?.components?.co || 0,
            'ozone': data.current?.components?.o3 || data.processed?.components?.o3 || 0,
            'no2': data.current?.components?.no2 || data.processed?.components?.no2 || 0,
            'nh3': data.current?.components?.nh3 || data.processed?.components?.nh3 || 0,
            dominant_pollutant: data.current?.dominant_pollutant || data.processed?.dominant_pollutant || '',
            health: data.health || {}
        };
    } catch (error) {
        console.error('❌ Error fetching current data:', error);
        
        // Show user-friendly error message
        if (error.message.includes('Failed to fetch')) {
            showNotification('Tidak dapat terhubung ke server. Pastikan backend berjalan dan CORS diaktifkan.', 'error');
        }
        
        // Return empty data
        return {
            timestamp: new Date().getTime(),
            aqi: 0,
            'pm2.5': 0,
            'pm10': 0,
            'co': 0,
            'ozone': 0,
            'no2': 0,
            'nh3': 0
        };
    }
}

// Fetch history data from API
async function fetchHistoryData() {
    try {
        const endpoint = locationEndpoints[currentLocation];
        
        // Cek apakah data ada di cache dan masih valid
        const cacheEntry = historyCache[currentTimeRange];
        const now = Date.now();
        const cacheTime = 5 * 60 * 1000; // Cache selama 5 menit
        
        if (cacheEntry.data.length > 0 && 
            now - cacheEntry.timestamp < cacheTime &&
            cacheEntry.location === currentLocation) {
            
            console.log(`📋 Using cached data for ${currentTimeRange}`);
            
            // Return data dari cache dalam format yang diharapkan
            const result = {
                history24h: [],
                history7d: [],
                history30d: [],
                analysis: null
            };
            
            // Hanya isi data untuk timeRange yang aktif
            switch(currentTimeRange) {
                case '24h': 
                    result.history24h = cacheEntry.data; 
                    result.analysis = cacheEntry.analysis;
                    break;
                case '7d': 
                    result.history7d = cacheEntry.data; 
                    result.analysis = cacheEntry.analysis;
                    break;
                case '30d': 
                    result.history30d = cacheEntry.data; 
                    result.analysis = cacheEntry.analysis;
                    break;
            }
            
            return result;
        }
        
        // Jika tidak ada di cache, ambil dari API
        let timeRange;
        switch(currentTimeRange) {
            case '24h': timeRange = '1d'; break;
            case '7d': timeRange = '7d'; break;
            case '30d': timeRange = '30d'; break;
            default: timeRange = '1d';
        }
        
        const url = `${BASE_URL}/${endpoint}/history?range=${timeRange}`;
        
        console.log(`📡 Fetching history data from: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ History data received:', data);
        
        // Convert readings to the format expected by our application
        const historyData = data.readings?.map(item => ({
            timestamp: firestoreTimestampToDate(item.timestamp).getTime(),
            aqi: item.aqi || 0,
            'pm2.5': item.components?.pm2_5 || 0,
            'pm10': item.components?.pm10 || 0,
            'co': item.components?.co || 0,
            'ozone': item.components?.o3 || 0,
            'no2': item.components?.no2 || 0,
            'nh3': item.components?.nh3 || 0,
            dominant_pollutant: item.dominant_pollutant || ''
        })) || [];
        
        // Extract analysis data
        const analysisData = data.analysis || null;
        
        // Simpan ke cache
        historyCache[currentTimeRange] = {
            data: historyData,
            analysis: analysisData,
            timestamp: now,
            location: currentLocation
        };
        
        // Buat objek hasil
        const result = {
            history24h: [],
            history7d: [],
            history30d: [],
            analysis: analysisData
        };
        
        // Isi data yang sesuai dengan timeRange aktif
        switch(currentTimeRange) {
            case '24h': result.history24h = historyData; break;
            case '7d': result.history7d = historyData; break;
            case '30d': result.history30d = historyData; break;
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error fetching history data:', error);
        return {
            history24h: [],
            history7d: [],
            history30d: [],
            analysis: null
        };
    }
}

// Fetch forecast data from API
async function fetchForecastData() {
    try {
        const endpoint = locationEndpoints[currentLocation];
        const url = `${BASE_URL}/${endpoint}/forecast`;
        
        console.log(`📡 Fetching forecast data from: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Forecast data received:', data);
        
        // Convert forecast readings to the expected format
        const forecast = data.forecastReadings?.map(item => ({
            timestamp: firestoreTimestampToDate(item.timestamp).getTime(),
            aqi: item.aqi || 0,
            'pm2.5': item.components?.pm2_5 || 0,
            'pm10': item.components?.pm10 || 0,
            'co': item.components?.co || 0,
            'ozone': item.components?.o3 || 0,
            'no2': item.components?.no2 || 0,
            'nh3': item.components?.nh3 || 0
        })) || [];
        
        return forecast;
    } catch (error) {
        console.error('❌ Error fetching forecast data:', error);
        return [];
    }
}

// Main fetch data function that combines all API calls
async function fetchData() {
    try {
        showLoadingIndicator();
        
        // Fetch all data in parallel for better performance
        const [currentData, historyData, forecastData] = await Promise.all([
            fetchCurrentData(),
            fetchHistoryData(),
            fetchForecastData()
        ]);
        
        // Combine all data into single object
        const combinedData = {
            current: currentData,
            history24h: historyData.history24h,
            history7d: historyData.history7d,
            history30d: historyData.history30d,
            forecast: forecastData,
            analysis: historyData.analysis
        };
        
        console.log('📊 All data combined:', combinedData);
        
        hideLoadingIndicator();
        
        return combinedData;
        
    } catch (error) {
        console.error('❌ Error in fetchData:', error);
        hideLoadingIndicator();
        showNotification('Gagal mengambil data. Silakan coba lagi.', 'error');
        
        // Return empty data structure
        return {
            current: {
                timestamp: new Date().getTime(),
                aqi: 0,
                'pm2.5': 0,
                'pm10': 0,
                'co': 0,
                'ozone': 0,
                'no2': 0,
                'nh3': 0
            },
            history24h: [],
            history7d: [],
            history30d: [],
            forecast: [],
            analysis: null
        };
    }
}

// Show loading indicator
function showLoadingIndicator() {
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage && dashboardPage.classList.contains('active')) {
        const cards = dashboardPage.querySelectorAll('.card');
        cards.forEach(card => {
            card.style.opacity = '0.6';
            card.style.pointerEvents = 'none';
        });
    }
}

// Hide loading indicator
function hideLoadingIndicator() {
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage) {
        const cards = dashboardPage.querySelectorAll('.card');
        cards.forEach(card => {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    console.log(`${type === 'error' ? '❌' : 'ℹ️'} ${message}`);
}

// ============== UI UPDATE FUNCTIONS ==============

// Update current date and time
function updateDateTime() {
    const now = new Date();
    const timeElement = document.getElementById('current-time');
    const dateElement = document.getElementById('current-date');
    const yearElement = document.getElementById('current-year');
    
    if (timeElement && dateElement) {
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        
        timeElement.textContent = `${hours}:${minutes}:${seconds}`;
        dateElement.textContent = formatFullDate(now);
    }
    
    if (yearElement) {
        yearElement.textContent = now.getFullYear();
    }
}

// Populate news container
function populateNewsContainer() {
    const newsContainer = document.getElementById('news-container');
    if (!newsContainer) return;
    
    newsContainer.innerHTML = '';
    
    newsItems.forEach(item => {
        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        
        const dateElement = document.createElement('div');
        dateElement.className = 'news-date';
        dateElement.textContent = formatFullDate(item.date);
        
        const titleElement = document.createElement('h4');
        titleElement.textContent = item.title;
        
        const contentElement = document.createElement('p');
        contentElement.textContent = item.content;
        
        newsItem.appendChild(dateElement);
        newsItem.appendChild(titleElement);
        newsItem.appendChild(contentElement);
        
        newsContainer.appendChild(newsItem);
    });
}

// Update AQI information display
function updateAqiDisplay(data) {
    const dashboardAqiValue = document.getElementById('dashboard-aqi-value');
    const dashboardAqiStatus = document.getElementById('dashboard-aqi-status');
    const dashboardAqiDescription = document.getElementById('dashboard-aqi-description');
    const dashboardLastUpdatedTime = document.getElementById('dashboard-last-updated-time');
    const dashboardMainAqiCard = document.querySelector('#dashboard-page .main-aqi');
    
    const aqiValue = data.current.aqi || 0;
    const status = getAqiStatus(aqiValue);
    
    // Apply AQI background color class
    const applyAqiClass = (element, aqi) => {
        if (!element) return;
        element.classList.remove('bg-good', 'bg-moderate', 'bg-sensitive', 'bg-unhealthy', 'bg-very-unhealthy', 'bg-hazardous');
        
        if (aqi <= 50) {
            element.classList.add('bg-good');
        } else if (aqi <= 100) {
            element.classList.add('bg-moderate');
        } else if (aqi <= 200) {
            element.classList.add('bg-unhealthy');
        } else if (aqi <= 300) {
            element.classList.add('bg-very-unhealthy');
        } else {
            element.classList.add('bg-hazardous');
        }
    };
    
    // Update dashboard page AQI
    if (dashboardAqiValue) dashboardAqiValue.textContent = aqiValue;
    if (dashboardAqiStatus) dashboardAqiStatus.innerHTML = `<span class="emoji">${status.emoji}</span><span class="status-text">${status.category}</span>`;
    if (dashboardAqiDescription) dashboardAqiDescription.textContent = status.description;
    if (dashboardLastUpdatedTime) {
        const date = new Date(data.current.timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        dashboardLastUpdatedTime.textContent = `${hours}:${minutes}:${seconds}`;
    }
    
    applyAqiClass(dashboardMainAqiCard, aqiValue);
    
    // Update current location name
    const locationNameElement = document.getElementById('current-location-name');
    if (locationNameElement) {
        let displayName = currentLocation.charAt(0).toUpperCase() + currentLocation.slice(1);
        if (currentLocation === 'bojongsoang') {
            displayName = 'Bojongsoang';
        }
        locationNameElement.textContent = displayName;
    }
}

// Update parameter values
function updateParameterValues(data) {
    const paramElements = {
        'pm2.5': document.getElementById('pm25-value'),
        'pm10': document.getElementById('pm10-value'),
        'co': document.getElementById('co-value'),
        'ozone': document.getElementById('ozone-value'),
        'no2': document.getElementById('no2-value'),
        'nh3': document.getElementById('nh3-value')
    };
    
    for (const [param, element] of Object.entries(paramElements)) {
        if (element) {
            const value = data.current[param] || 0;
            element.textContent = value;
            
            // Mendapatkan status parameter dan menerapkan warna pada nilai di kartu parameter
            const paramKey = param === 'pm2.5' ? 'pm25' : param;
            const status = getParameterStatus(paramKey, value);
            if (status) {
                element.style.color = status.color;
                element.style.textShadow = `0 0 10px ${status.color}40`;
            }
        }
    }
}

// ============== CHART FUNCTIONS ==============

// Initialize AQI History Chart
function initAqiHistoryChart(data) {
    const ctx = document.getElementById('aqi-history-chart');
    if (!ctx) return;
    
    const ctxContext = ctx.getContext('2d');
    
    if (aqiHistoryChart) {
        aqiHistoryChart.destroy();
    }
    
    // Select data based on time range
    let historyData;
    let xAxisTitle;
    
    switch(currentTimeRange) {
        case '24h':
            historyData = data.history24h || [];
            xAxisTitle = 'Waktu (Jam)';
            break;
        case '7d':
            historyData = data.history7d || [];
            xAxisTitle = 'Tanggal';
            break;
        case '30d':
            historyData = data.history30d || [];
            xAxisTitle = 'Tanggal';
            break;
        default:
            historyData = data.history24h || [];
            xAxisTitle = 'Waktu (Jam)';
    }
    
    // Update statistik berdasarkan analisis dari server
    updateHistoryStats(data.analysis);
    
    // Check if we have data
    if (historyData.length === 0) {
        console.warn('⚠️ No history data available for chart');
        ctxContext.clearRect(0, 0, ctx.width, ctx.height);
        ctxContext.font = '16px Arial';
        ctxContext.textAlign = 'center';
        ctxContext.fillText('Data history belum tersedia', ctx.width / 2, ctx.height / 2);
        return;
    }
    
    const labels = historyData.map(item => getTimeLabel(item.timestamp, currentTimeRange));
    const aqiData = historyData.map(item => item.aqi || 0);
    const colors = aqiData.map(value => getAqiStatus(value).color);
    
    const gradient = ctxContext.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(58, 123, 213, 0.2)');
    gradient.addColorStop(1, 'rgba(58, 123, 213, 0.0)');
    
    aqiHistoryChart = new Chart(ctxContext, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'AQI',
                data: aqiData,
                borderColor: '#3a7bd5',
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: colors,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: currentTimeRange === '30d' ? 3 : 5,
                pointHoverRadius: currentTimeRange === '30d' ? 5 : 7,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
            intersect: false,
               mode: 'index'
           },
           plugins: {
               tooltip: {
                   callbacks: {
                       label: function(context) {
                           const value = context.raw;
                           const status = getAqiStatus(value).category;
                           return `AQI: ${value} (${status})`;
                       }
                   },
                   backgroundColor: 'rgba(255, 255, 255, 0.9)',
                   titleColor: '#333',
                   bodyColor: '#333',
                   borderColor: '#3a7bd5',
                   borderWidth: 1,
                   padding: 10,
                   cornerRadius: 6,
                   displayColors: false
               },
               legend: {
                   display: false
               }
           },
           scales: {
               y: {
                   beginAtZero: true,
                   title: {
                       display: true,
                       text: 'Nilai AQI',
                       font: {
                           weight: 'bold'
                       }
                   },
                   grid: {
                       color: 'rgba(0, 0, 0, 0.05)'
                   }
               },
               x: {
                   grid: {
                       display: false
                   },
                   title: {
                       display: true,
                       text: xAxisTitle,
                       font: {
                           weight: 'bold'
                       }
                   },
                   ticks: {
                       maxRotation: 45,
                       minRotation: 45,
                       maxTicksLimit: currentTimeRange === '30d' ? 10 : (currentTimeRange === '7d' ? 7 : 12)
                   }
               }
           },
           animation: {
               duration: 1000
           }
       }
   });
}

// Fungsi untuk update statistik dari data analisis
function updateHistoryStats(analysis) {
  // Elemen-elemen statistik
  const dominantPolutanEl = document.getElementById('dominant-polutan');
  const maxAqiEl = document.getElementById('max-aqi');
  const minAqiEl = document.getElementById('min-aqi');
  const avgAqiEl = document.getElementById('avg-aqi');
  
  if (!analysis) {
      // Jika tidak ada data analisis, tampilkan tanda strip
      dominantPolutanEl.textContent = '-';
      maxAqiEl.textContent = '-';
      minAqiEl.textContent = '-';
      avgAqiEl.textContent = '-';
      return;
  }
  
  // Update nilai statistik dari data analisis
  // Format dominant pollutant untuk tampilan yang lebih baik
  const dominantPollutant = analysis.dominantPollutant?.name || '-';
  let formattedPollutant = dominantPollutant;
  
  // Convert format (misalnya "pm2_5" menjadi "PM2.5")
  if (dominantPollutant === 'pm2_5') {
      formattedPollutant = 'PM2.5';
  } else if (dominantPollutant === 'pm10') {
      formattedPollutant = 'PM10';
  } else if (dominantPollutant === 'o3') {
      formattedPollutant = 'O₃';
  } else if (dominantPollutant === 'no2') {
      formattedPollutant = 'NO₂';
  } else if (dominantPollutant === 'nh3') {
      formattedPollutant = 'NH₃';
  } else if (dominantPollutant === 'co') {
      formattedPollutant = 'CO';
  } else {
      formattedPollutant = dominantPollutant.toUpperCase();
  }
  
  dominantPolutanEl.textContent = formattedPollutant;
  maxAqiEl.textContent = analysis.maxAQI?.value || '-';
  minAqiEl.textContent = analysis.minAQI?.value || '-';
  avgAqiEl.textContent = analysis.averageAQI?.toFixed(1) || '-';
}

// Initialize AQI Forecast Chart
function initAqiForecastChart(data) {
  const ctx = document.getElementById('aqi-forecast-chart');
  if (!ctx) return;
  
  const ctxContext = ctx.getContext('2d');
  
  if (aqiForecastChart) {
      aqiForecastChart.destroy();
  }
  
  const forecastData = data.forecast || [];
  
  // Check if we have data
  if (forecastData.length === 0) {
      console.warn('⚠️ No forecast data available for chart');
      ctxContext.clearRect(0, 0, ctx.width, ctx.height);
      ctxContext.font = '16px Arial';
      ctxContext.textAlign = 'center';
      ctxContext.fillText('Data prakiraan belum tersedia', ctx.width / 2, ctx.height / 2);
      return;
  }
  
  const labels = forecastData.map(item => formatTime(item.timestamp));
  const aqiData = forecastData.map(item => item.aqi || 0);
  const colors = aqiData.map(value => getAqiStatus(value).color);
  
  const gradient = ctxContext.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(0, 210, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');
  
  aqiForecastChart = new Chart(ctxContext, {
      type: 'line',
      data: {
          labels: labels,
          datasets: [{
              label: 'Prediksi AQI',
              data: aqiData,
              borderColor: '#00d2ff',
              backgroundColor: gradient,
              borderWidth: 3,
              tension: 0.4,
              pointBackgroundColor: colors,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7,
              fill: true
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
              intersect: false,
              mode: 'index'
          },
          plugins: {
              tooltip: {
                  callbacks: {
                      label: function(context) {
                          const value = context.raw;
                          const status = getAqiStatus(value).category;
                          return `Prediksi AQI: ${value} (${status})`;
                      }
                  },
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  titleColor: '#333',
                  bodyColor: '#333',
                  borderColor: '#00d2ff',
                  borderWidth: 1,
                  padding: 10,
                  cornerRadius: 6,
                  displayColors: false
              },
              legend: {
                  display: false
              }
          },
          scales: {
              y: {
                  beginAtZero: true,
                  title: {
                      display: true,
                      text: 'Nilai AQI',
                      font: {
                          weight: 'bold'
                      }
                  },
                  grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                  }
              },
              x: {
                  grid: {
                      display: false
                  },
                  title: {
                      display: true,
                      text: 'Waktu (Jam)',
                      font: {
                          weight: 'bold'
                      }
                  },
                  ticks: {
                      maxRotation: 45,
                      minRotation: 45,
                      maxTicksLimit: 12
                  }
              }
          },
          animation: {
              duration: 1000
          }
      }
  });
}

// ============== MAP INITIALIZATION ==============

function initMap() {
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) return;
  
  // Clear existing map
  if (skylensMap) {
      try {
          skylensMap.remove();
      } catch (e) {
          console.log('Map cleanup:', e);
      }
      skylensMap = null;
  }
  
  // Clear container
  mapContainer.innerHTML = '';
  
  // Small delay to ensure container is ready
  setTimeout(async () => {
      try {
          // Create new map instance
          skylensMap = L.map('map-container').setView([
              locationCoordinates[currentLocation].lat, 
              locationCoordinates[currentLocation].lng
          ], 10);
          
          // Add tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(skylensMap);
          
          // Fetch AQI data for all locations
          const locationData = {};
          
          for (const location in locationCoordinates) {
              try {
                  const endpoint = locationEndpoints[location];
                  const response = await fetch(`${BASE_URL}/${endpoint}`);
                  if (response.ok) {
                      const data = await response.json();
                      // Perbaikan akses ke struktur data API
                      locationData[location] = data.current?.aqi || data.processed?.aqi || 0;
                  } else {
                      locationData[location] = 0;
                  }
              } catch (error) {
                  console.error(`Error fetching AQI for ${location}:`, error);
                  locationData[location] = 0;
              }
          }
          
          // Add markers for all locations - with updated AQI colors
          for (const location in locationCoordinates) {
              const coords = locationCoordinates[location];
              const aqiValue = locationData[location];
              const status = getAqiStatus(aqiValue);
              
              const markerHtml = `
                  <div class="custom-marker-container">
                      <div style="background-color: ${status.color}; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
                          ${aqiValue}
                      </div>
                  </div>
              `;
              
              const markerIcon = L.divIcon({
                  className: 'custom-marker',
                  html: markerHtml,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20],
                  popupAnchor: [0, -20]
              });
              
              let displayName = location.charAt(0).toUpperCase() + location.slice(1);
              if (location === 'bojongsoang') {
                  displayName = 'Bojongsoang';
              }
              
              const marker = L.marker([coords.lat, coords.lng], { icon: markerIcon })
                  .addTo(skylensMap)
                  .bindPopup(`
                      <div class="map-popup">
                          <h3>${displayName}</h3>
                          <div class="popup-aqi" style="font-size: 28px; font-weight: bold; color: ${status.color}; margin: 10px 0;">${aqiValue}</div>
                          <div class="popup-status">${status.emoji} ${status.category}</div>
                          <div class="popup-time">Update terakhir: ${formatTime(new Date().getTime())}</div>
                      </div>
                  `, {
                      className: 'custom-popup',
                      minWidth: 180
                  });
              
              // Add click event to change location
              marker.on('click', function() {
                  changeLocation(location);
              });
              
              if (location === currentLocation) {
                  marker.openPopup();
              }
          }
      } catch (error) {
          console.error('Map initialization error:', error);
      }
  }, 100);
}

// ============== EVENT HANDLERS ==============

// Handle navigation
function handleNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Remove active class from all links and pages
          navLinks.forEach(item => item.classList.remove('active'));
          document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
          
          // Add active class to clicked link
          this.classList.add('active');
          
          // Show corresponding page
          const pageId = `${this.dataset.page}-page`;
          document.getElementById(pageId).classList.add('active');
          
          // Simpan state halaman saat ini
          localStorage.setItem('currentPage', this.dataset.page);
          
          // Special case for dashboard page - refresh charts
          if (pageId === 'dashboard-page') {
              setTimeout(() => {
                  fetchData().then(data => {
                      initAqiHistoryChart(data);
                      initAqiForecastChart(data);
                      initMap();
                  });
              }, 100);
          }
      });
  });
}

// Handle location selection
function handleLocationSelection() {
  const locationCards = document.querySelectorAll('.location-card');
  const changeLocationBtn = document.getElementById('change-location-btn');
  
  if (locationCards.length > 0) {
      locationCards.forEach(card => {
          card.addEventListener('click', function() {
              const location = this.dataset.location;
              changeLocation(location);
              
              // Switch to dashboard page automatically
              const dashboardLink = document.querySelector('.nav-link[data-page="dashboard"]');
              if (dashboardLink) {
                  dashboardLink.click();
              }
          });
      });
  }
  
  // Handle change location button in dashboard
  if (changeLocationBtn) {
      changeLocationBtn.addEventListener('click', () => {
          // Switch back to home page for location selection
          const homeLink = document.querySelector('.nav-link[data-page="home"]');
          if (homeLink) {
              homeLink.click();
          }
      });
  }
}

// Handle time range selector
function handleTimeRangeSelector() {
  const timeRangeBtns = document.querySelectorAll('.time-range-btn');
  
  timeRangeBtns.forEach(btn => {
      btn.addEventListener('click', async function() {
          // Remove active class from all buttons
          timeRangeBtns.forEach(b => b.classList.remove('active'));
          
          // Add active class to clicked button
          this.classList.add('active');
          
          // Update current time range
          currentTimeRange = this.dataset.range;
          
          // Destroy existing chart
          if (aqiHistoryChart) {
              aqiHistoryChart.destroy();
              aqiHistoryChart = null;
          }
          
          // Show loading text on chart canvas
          const ctx = document.getElementById('aqi-history-chart');
          if (ctx) {
              const ctxContext = ctx.getContext('2d');
              ctxContext.clearRect(0, 0, ctx.width, ctx.height);
              ctxContext.font = '16px Arial';
              ctxContext.textAlign = 'center';
              ctxContext.fillText('Memuat data...', ctx.width / 2, ctx.height / 2);
          }
          
          // Refresh chart with new data
          try {
              const data = await fetchData();
              initAqiHistoryChart(data);
          } catch (error) {
              console.error('Error updating chart:', error);
          }
      });
  });
}

// Handle parameter cards click for showing modal
function handleParameterCardClick() {
  const parameterCards = document.querySelectorAll('.parameter-card');
  const modal = document.getElementById('parameter-modal');
  const closeModal = document.querySelector('.close-modal');
  
  if (parameterCards.length > 0 && modal) {
      parameterCards.forEach(card => {
          card.addEventListener('click', function() {
              const param = this.dataset.param;
              showParameterModal(param);
          });
      });
      
      if (closeModal) {
          closeModal.addEventListener('click', function() {
              modal.style.display = 'none';
          });
      }
      
      // Close modal when clicking outside of it
      window.addEventListener('click', function(e) {
          if (e.target === modal) {
              modal.style.display = 'none';
          }
      });
  }
}

// Show parameter modal with data - Updated dengan dynamic color pada nilai parameter
function showParameterModal(param) {
  const modal = document.getElementById('parameter-modal');
  const modalTitle = document.getElementById('modal-param-title');
  const modalValue = document.getElementById('modal-param-value');
  const modalUnit = document.getElementById('modal-param-unit');
  const modalStatus = document.getElementById('modal-param-status');
  const modalDescription = document.getElementById('modal-param-description');
  const modalAbout = document.getElementById('modal-param-about');
  const modalSources = document.getElementById('modal-param-sources');
  const modalHealth = document.getElementById('modal-param-health');
  const modalRecommendations = document.getElementById('modal-param-recommendations');
  
  // Get current parameter value
  const currentValue = document.getElementById(`${param.replace('ozone', 'ozone')}-value`)?.textContent || '0';
  
  // Parameter information with updated thresholds and dynamic health impacts
  const paramInfo = {
      pm25: {
          title: 'PM2.5',
          unit: 'µg/m³',
          about: 'PM2.5 adalah partikel halus dengan diameter 2.5 mikrometer atau kurang. Dapat menembus jauh ke dalam paru-paru dan aliran darah.',
          sources: 'Pembakaran bahan bakar fosil, kebakaran hutan, debu jalan, industri, asap kendaraan bermotor.',
          recommendations: 'Gunakan masker N95 saat AQI tinggi, hindari aktivitas luar ruangan yang berat, gunakan air purifier di dalam ruangan.',
          thresholds: {
              good: 15,
              moderate: 55,
              sensitive: 150,
              unhealthy: 250,
              very_unhealthy: 350
          },
          healthImpacts: {
              good: 'Tidak berdampak pada kesehatan.',
              moderate: 'Mulai berdampak pada paru-paru.',
              sensitive: 'Resiko tinggi pada penderita penyakit jantung.',
              unhealthy: 'Gangguan paru-paru dan jantung.',
              very_unhealthy: 'Efek sistemik dan inflamasi.',
              hazardous: 'Resiko kanker dan serangan jantung.'
          }
      },
      pm10: {
          title: 'PM10',
          unit: 'µg/m³',
          about: 'PM10 adalah partikel dengan diameter 10 mikrometer atau kurang. Termasuk debu, serbuk sari, dan partikel organik.',
          sources: 'Aktivitas konstruksi, jalan berdebu, pembakaran biomassa, proses industri, erosi tanah.',
          recommendations: 'Hindari area berdebu, tutup jendela saat kualitas udara buruk, bersihkan rumah secara teratur.',
          thresholds: {
              good: 50,
              moderate: 150,
              sensitive: 250,
              unhealthy: 350,
              very_unhealthy: 420
          },
          healthImpacts: {
              good: 'Aman bagi populasi umum.',
              moderate: 'Iritasi ringan bagi kelompok sensitif.',
              sensitive: 'Resiko pada penderita asma.',
              unhealthy: 'Gangguan paru-paru sedang.',
              very_unhealthy: 'Pemburukan kondisi paru-paru.',
              hazardous: 'Resiko jangka panjang dan akut.'
          }
      },
      co: {
          title: 'CO',
          unit: 'µg/m³',
          about: 'Carbon Monoxide adalah gas tidak berwarna, tidak berbau yang dihasilkan dari pembakaran tidak sempurna bahan bakar.',
          sources: 'Kendaraan bermotor, pembakaran kayu, alat pemanas, generator, kompor gas yang tidak terawat.',
          recommendations: 'Pastikan ventilasi yang baik, periksa alat pembakaran secara berkala, gunakan detektor CO.',
          thresholds: {
              good: 5000,
              moderate: 10000,
              sensitive: 17000,
              unhealthy: 34000,
              very_unhealthy: 46000
          },
          healthImpacts: {
              good: 'Aman bagi sistem pernapasan.',
              moderate: 'Resiko ringan bagi jantung dan otak.',
              sensitive: 'Resiko bagi penderita penyakit jantung.',
              unhealthy: 'Sakit kepala, pusing, gangguan oksigen.',
              very_unhealthy: 'Resiko keracunan.',
              hazardous: 'Potensi fatal.'
          }
      },
      ozone: {
          title: 'O₃',
          unit: 'µg/m³',
          about: 'Ozone adalah gas yang terbentuk dari reaksi kimia antara nitrogen oksida (NOx) dan senyawa organik volatile (VOC) di bawah sinar matahari.',
          sources: 'Emisi kendaraan, industri, cat, pelarut, pembangkit listrik yang bereaksi dengan sinar matahari.',
          recommendations: 'Hindari aktivitas luar ruangan pada siang hari saat AQI tinggi, tetap di dalam ruangan ber-AC.',
          thresholds: {
              good: 100,
              moderate: 130,
              sensitive: 160,
              unhealthy: 200,
              very_unhealthy: 300
          },
          healthImpacts: {
              good: 'Tidak menimbulkan efek kesehatan.',
              moderate: 'Mulai berdampak bagi kelompok sensitif.',
              sensitive: 'Memengaruhi penderita asma dan anak-anak.',
              unhealthy: 'Menyebabkan gangguan pernapasan ringan.',
              very_unhealthy: 'Efek merata pada seluruh populasi.',
              hazardous: 'Dampak kesehatan serius dan luas.'
          }
      },
      no2: {
          title: 'NO₂',
          unit: 'µg/m³',
          about: 'Nitrogen Dioxide adalah gas berwarna coklat kemerahan dengan bau menyengat yang dihasilkan dari pembakaran pada suhu tinggi.',
          sources: 'Kendaraan bermotor, pembangkit listrik, proses industri, pembakaran bahan bakar fosil.',
          recommendations: 'Hindari jalan raya yang padat, gunakan transportasi umum, hindari olahraga di dekat jalan raya.',
          thresholds: {
              good: 40,
              moderate: 80,
              sensitive: 180,
              unhealthy: 280,
              very_unhealthy: 400
          },
          healthImpacts: {
              good: 'Tidak berbahaya.',
              moderate: 'Iritasi ringan.',
              sensitive: 'Gangguan paru-paru ringan.',
              unhealthy: 'Memicu bronkitis dan asma.',
              very_unhealthy: 'Resiko infeksi saluran pernapasan.',
              hazardous: 'Efek toksik sistemik.'
          }
      },
      nh3: {
          title: 'NH₃',
          unit: 'µg/m³',
          about: 'Ammonia adalah gas tidak berwarna dengan bau menyengat yang kuat, mudah larut dalam air.',
          sources: 'Pertanian (pupuk, kotoran ternak), proses industri, pembangkit listrik, kendaraan dengan sistem SCR.',
          recommendations: 'Hindari area pertanian saat penyemprotan pupuk, gunakan masker di area industri.',
          thresholds: {
              good: 100,
              moderate: 200,
              sensitive: 300,
              unhealthy: 400,
              very_unhealthy: 600
          },
          healthImpacts: {
              good: 'Tidak menimbulkan iritasi.',
              moderate: 'Mulai iritasi hidung dan mata.',
              sensitive: 'Resiko bagi anak dan lansia.',
              unhealthy: 'Memicu batuk dan nyeri dada.',
              very_unhealthy: 'Sesak napas, gangguan pada jaringan paru-paru.',
              hazardous: 'Efek toksik berat.'
          }
      }
  };
  
  const info = paramInfo[param];
  if (info && modal) {
      modalTitle.textContent = info.title;
      modalValue.textContent = currentValue;
      modalUnit.textContent = info.unit;
      
      // Determine status based on current value and thresholds
      let statusText = 'Normal';
      let statusColor = '#00e400';
      let statusDescription = `Tingkat ${info.title} saat ini dalam batas normal.`;
      let healthImpact = info.healthImpacts.good;
      
      const value = parseFloat(currentValue);
      if (value <= info.thresholds.good) {
          statusText = 'Baik';
          statusColor = '#00e400'; // Hijau
          statusDescription = `Tingkat ${info.title} berada pada level aman.`;
          healthImpact = info.healthImpacts.good;
      } else if (value <= info.thresholds.moderate) {
          statusText = 'Sedang';
          statusColor = '#ffff00'; // Kuning (sesuai AQI)
          statusDescription = `Kadar ${info.title} dapat diterima tetapi mungkin sedikit mempengaruhi beberapa orang yang sangat sensitif.`;
          healthImpact = info.healthImpacts.moderate;
      } else if (value <= info.thresholds.sensitive) {
          statusText = 'Tidak Sehat untuk Kelompok Sensitif';
          statusColor = '#ff7e00'; // Oranye
          statusDescription = `Kelompok sensitif mungkin mengalami efek kesehatan dari tingkat ${info.title} saat ini.`;
          healthImpact = info.healthImpacts.sensitive;
      } else if (value <= info.thresholds.unhealthy) {
          statusText = 'Tidak Sehat';
          statusColor = '#ff0000'; // Merah
          statusDescription = `Tingkat ${info.title} yang tinggi dapat mempengaruhi kesehatan setiap orang.`;
          healthImpact = info.healthImpacts.unhealthy;
      } else if (value <= info.thresholds.very_unhealthy) {
          statusText = 'Sangat Tidak Sehat';
          statusColor = '#8f3f97'; // Ungu
          statusDescription = `Tingkat ${info.title} berbahaya dan dapat menyebabkan dampak kesehatan yang serius.`;
          healthImpact = info.healthImpacts.very_unhealthy;
      } else {
          statusText = 'Berbahaya';
          statusColor = '#000000'; // Hitam
          statusDescription = `Tingkat ${info.title} sangat berbahaya dan dapat menyebabkan efek kesehatan yang serius.`;
          healthImpact = info.healthImpacts.hazardous;
      }
      
      // Set status text dan warna
      modalStatus.textContent = statusText;
      modalStatus.style.color = statusColor;
      
      // Set warna pada nilai parameter
      modalValue.style.color = statusColor;
      modalValue.style.textShadow = `0 0 10px ${statusColor}40`;
      
      modalDescription.textContent = statusDescription;
      
      modalAbout.textContent = info.about;
      modalSources.textContent = info.sources;
      modalHealth.textContent = healthImpact;
      modalRecommendations.textContent = info.recommendations;
      
      modal.style.display = 'block';
  }
}

// Handle pollutant tabs in education card
function handlePollutantTabs() {
  const pollutantTabs = document.querySelectorAll('.pollutant-tab');
  
  pollutantTabs.forEach(tab => {
      tab.addEventListener('click', function() {
          // Remove active class from all tabs and content
          pollutantTabs.forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.pollutant-info').forEach(content => content.classList.remove('active'));
          
          // Add active class to clicked tab
          this.classList.add('active');
          
          // Show corresponding content
          const pollutantType = this.dataset.pollutant;
          const contentId = `${pollutantType}-info`;
          
          const contentElement = document.getElementById(contentId);
          if (contentElement) {
              contentElement.classList.add('active');
          }
      });
  });
}

// Change location
function changeLocation(location) {
  if (locationCoordinates[location]) {
      currentLocation = location;
      console.log(`📍 Location changed to: ${location}`);
      
      // Simpan lokasi saat ini
      localStorage.setItem('currentLocation', location);
      
      // Reset cache for this location change
      Object.keys(historyCache).forEach(key => {
          historyCache[key].location = '';
      });
      
      // Update UI to reflect new location
      updateAllData();
  }
}

// Update all data on the page
function updateAllData() {
  fetchData().then(data => {
      updateAqiDisplay(data);
      updateParameterValues(data);
      
      // Update charts if we're on dashboard page
      const dashboardPage = document.getElementById('dashboard-page');
      if (dashboardPage && dashboardPage.classList.contains('active')) {
          initAqiHistoryChart(data);
          initAqiForecastChart(data);
      }
      
      initMap();
  }).catch(error => {
      console.error('Error updating data:', error);
  });
}

// ============== INITIALIZATION ==============

// Test API connection on page load
async function testAPIConnection() {
  console.log('🔍 Testing API connection...');
  try {
      // Ganti endpoint ke Jalan Radio karena itu satu-satunya yang tersedia
      const response = await fetch(`${BASE_URL}/Jalan Radio`);
      if (response.ok) {
          console.log('✅ API Connected Successfully!');
          const data = await response.json();
          console.log('📡 Sample data:', data);
      } else {
          console.error('❌ API returned error:', response.status);
          alert(`API Error: ${response.status}. Pastikan backend berjalan dengan benar.`);
      }
  } catch (error) {
      console.error('❌ Cannot connect to API:', error.message);
      if (error.message.includes('Failed to fetch')) {
          alert(`Tidak dapat terhubung ke API di ${BASE_URL}\n\nPastikan:\n1. Backend server sudah running\n2. CORS sudah diaktifkan\n3. Tidak ada firewall yang memblokir`);
      }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 SkyLens Air Quality Monitoring System Starting...');
  
  // Test API connection first
  testAPIConnection();
  
  // Initialize date and time display
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Populate news container with data
  populateNewsContainer();
  
  // Initialize event handlers
  handleNavigation();
  handleLocationSelection();
  handleParameterCardClick();
  handlePollutantTabs();
  handleTimeRangeSelector();
  
  // Initial data update
  updateAllData();
  
  // Set up periodic data refresh (every 2 minutes)
  setInterval(updateAllData, 120000);
  
  console.log('✅ SkyLens initialized successfully!');
});

// Make functions globally available
window.changeLocation = changeLocation;