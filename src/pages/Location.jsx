import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

function Location() {
  const { name } = useParams()
  const [currentData, setCurrentData] = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [currentResponse, historicalResponse] = await Promise.all([
          axios.get(`http://localhost:3000/${name}`),
          axios.get(`http://localhost:3000/${name}/history`)
        ])
        
        setCurrentData(currentResponse.data)
        setHistoricalData(historicalResponse.data)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchData()
  }, [name])

  if (loading) return <div className="text-center">Loading...</div>
  if (error) return <div className="text-red-500">Error: {error}</div>

  const chartData = {
    labels: historicalData?.readings.map(reading => 
      new Date(reading.timestamp).toLocaleTimeString()
    ) || [],
    datasets: [
      {
        label: 'AQI',
        data: historicalData?.readings.map(reading => reading.aqi) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  }

  const getAQIColor = (aqi) => {
    if (aqi <= 50) return 'from-green-400 to-green-600'
    if (aqi <= 100) return 'from-yellow-400 to-yellow-600'
    if (aqi <= 150) return 'from-orange-400 to-orange-600'
    if (aqi <= 200) return 'from-red-400 to-red-600'
    if (aqi <= 300) return 'from-purple-400 to-purple-600'
    return 'from-red-800 to-red-900'
  }

  const getRiskLevelColor = (riskLevel) => {
    const level = riskLevel?.toLowerCase()
    if (level?.includes('good')) return 'text-green-600 bg-green-50'
    if (level?.includes('moderate')) return 'text-yellow-600 bg-yellow-50'
    if (level?.includes('unhealthy')) return 'text-red-600 bg-red-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="space-y-8">
      {/* Location Header */}
      <section className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {decodeURIComponent(name)}
            </h1>
            <p className="text-xl opacity-90">Air Quality Monitoring</p>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Current Data Cards */}
      {currentData && (
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="group bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700">Current AQI</h2>
              <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${getAQIColor(currentData.aqi)}`}></div>
            </div>
            <p className={`text-5xl font-bold bg-gradient-to-r ${getAQIColor(currentData.aqi)} bg-clip-text text-transparent mb-2`}>
              {currentData.aqi}
            </p>
            <div className={`w-full h-2 rounded-full bg-gradient-to-r ${getAQIColor(currentData.aqi)} opacity-60`}></div>
          </div>
          
          <div className="group bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700">Risk Level</h2>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className={`inline-block px-4 py-2 rounded-full font-semibold text-lg ${getRiskLevelColor(currentData.health.riskLevel)}`}>
              {currentData.health.riskLevel}
            </div>
          </div>

          <div className="group bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700">Dominant Pollutant</h2>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-primary bg-primary/10 inline-block px-4 py-2 rounded-lg">
              {currentData.dominant_pollutant}
            </p>
          </div>
        </section>
      )}

      {/* Historical Data Chart */}
      {historicalData && (
        <section className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg mr-3"></div>
            <h2 className="text-3xl font-bold text-gray-800">Historical Trends</h2>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-100">
            <div className="h-[400px]">
              <Line 
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: {
                        usePointStyle: true,
                        font: {
                          size: 14,
                          weight: 'bold'
                        }
                      }
                    },
                    title: {
                      display: true,
                      text: 'AQI Over Time',
                      font: {
                        size: 18,
                        weight: 'bold'
                      },
                      color: '#374151'
                    }
                  },
                  scales: {
                    y: {
                      grid: {
                        color: '#f3f4f6'
                      },
                      ticks: {
                        font: {
                          weight: 'bold'
                        }
                      }
                    },
                    x: {
                      grid: {
                        color: '#f3f4f6'
                      },
                      ticks: {
                        font: {
                          weight: 'bold'
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Health Recommendations */}
      {currentData?.health && (
        <section className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-red-400 to-pink-500 rounded-lg mr-3"></div>
            <h2 className="text-3xl font-bold text-gray-800">Health Recommendations</h2>
          </div>
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
              <p className="text-gray-700 leading-relaxed text-lg">{currentData.health.generalMessage}</p>
            </div>
            
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-r-xl p-6 shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-800 mb-2">For Sensitive Groups:</p>
                  <p className="text-gray-700 leading-relaxed">{currentData.health.vulnerableMessage}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-bold text-xl mb-4 text-gray-800 flex items-center">
                <svg className="w-6 h-6 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recommended Actions:
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {currentData.health.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start bg-white rounded-lg p-4 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p className="text-gray-700 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default Location
