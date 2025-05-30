import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/')
        setData(response.data)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div className="text-center">Loading...</div>
  if (error) return <div className="text-red-500">Error: {error}</div>

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Air Quality Dashboard</h1>
        <p className="text-gray-600">Welcome to SkyLENS Air Quality Monitoring System</p>
      </section>

      {data?.news && (
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Latest Environmental News</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.news.articles?.map((article, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">{article.title}</h3>
                <p className="text-gray-600 text-sm mb-2">{article.description}</p>
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-secondary"
                >
                  Read more
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {data?.dailyTip && (
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Daily Tip</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <h3 className="font-semibold mb-2">{data.dailyTip.title}</h3>
            <p className="text-gray-600 mb-2">{data.dailyTip.fact}</p>
            <p className="text-primary">{data.dailyTip.tip}</p>
          </div>
        </section>
      )}
    </div>
  )
}

export default Home