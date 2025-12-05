import './App.css'
import { DCRCalculator } from './components/dcr-calculator'

function App() {
  return (
    <div className="container mx-auto py-8 font-mono">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">DCR Calculator</h1>
        <p className="text-muted-foreground">
          Calculate Dynamic Compression Ratio based on valve timing (LSA, Duration @ 0.050").
        </p>
      </header>
      <DCRCalculator />
    </div>
  )
}

export default App
