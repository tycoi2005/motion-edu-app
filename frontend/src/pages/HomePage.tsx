import React from 'react'
import { getCategories } from '../data/flashcards'
import CameraFeed from '../components/CameraFeed'

const HomePage: React.FC = () => {
  const categories = getCategories()

  return (
    <div>
      <h1>Motion-Based German Flashcards</h1>
      <p>This is a webcam and gesture-controlled vocabulary trainer.</p>
      <ul>
        {categories.map((cat) => (
          <li key={cat.id}>{cat.label}</li>
        ))}
      </ul>
      <CameraFeed />
    </div>
  )
}

export default HomePage

