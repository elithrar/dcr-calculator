import './App.css'
import { DCRCalculator } from './components/dcr-calculator'

function App() {
  return (
    <div className="container mx-auto py-8 font-mono">
      <h1 className="text-center text-3xl font-bold mb-6">DCR Calculator</h1>
      <DCRCalculator />
    </div>
  )
}

export default App