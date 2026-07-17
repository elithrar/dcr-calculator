import './App.css'
import { DCRCalculator } from './components/dcr-calculator'
import { DrivetrainPresets } from './components/drivetrain-presets'

function App() {
  return (
    <div className="container mx-auto py-8 font-mono">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">DCR Calculator</h1>
        <p className="text-muted-foreground">
          Calculate Dynamic Compression Ratio based on camshaft specs & valve timing.
        </p>
      </header>
      <div className="space-y-6">
        <DCRCalculator />
        <DrivetrainPresets />
      </div>
    </div>
  )
}

export default App
