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

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          {decodeURIComponent(name)} Air Quality
        </h1>
        
        {currentData && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="font-semibold mb-2">Current AQI</h2>
              <p className="text-4xl font-bold text-primary">{currentData.aqi}</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="font-semibold mb-2">Risk Level</h2>
              <p className="text-xl text-primary">{currentData.health.riskLevel}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="font-semibold mb-2">Dominant Pollutant</h2>
              <p className="text-xl text-primary">{currentData.dominant_pollutant}</p>
            </div>
          </div>
        )}
      </section>

      {historicalData && (
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Historical Data</h2>
          <div className="h-[400px]">
            <Line 
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: 'AQI Over Time'
                  }
                }
              }}
            />
          </div>
        </section>
      )}

      {currentData?.health && (
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Health Recommendations</h2>
          <div className="space-y-4">
            <p className="text-gray-600">{currentData.health.generalMessage}</p>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <p className="font-semibold">For Sensitive Groups:</p>
              <p className="text-gray-600">{currentData.health.vulnerableMessage}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Recommendations:</h3>
              <ul className="list-disc list-inside space-y-2">
                {currentData.health.recommendations.map((rec, index) => (
                  <li key={index} className="text-gray-600">{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default Location