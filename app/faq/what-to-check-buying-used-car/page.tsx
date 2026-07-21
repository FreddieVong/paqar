/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Complete Checklist: What to Check Before Buying a Used Car | Paqar',
  description: 'Step-by-step inspection guide: interior, exterior, engine, electrical, test drive. What to look for, what to walk away from.',
}

export default function ChecklistBuyingUsedCar() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">Complete Checklist: What to Check When Buying a Used Car</h1>
      <p className="text-lg text-[#6B7280] mb-6">Professional buyer's checklist. Print and bring to every viewing.</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#064E4A] mb-2">Golden Rule</p>
        <p className="text-[#374151]">If anything feels wrong, walk away. There's always another car.</p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Pre-Viewing (Phone)</h2>
        <div className="space-y-3 text-[#374151]">
          <p>Before you even go see the car:</p>
          <div className="bg-[#F9FAFB] p-4 rounded space-y-2">
            <p>☐ Ask seller: "How many previous owners?"  (1–2 owners = good)</p>
            <p>☐ Ask: "Any accidents or flood damage?" (Watch for hesitation)</p>
            <p>☐ Get the plate number → Check Paqar valuation (know market price)</p>
            <p>☐ Ask for photos of interior, engine bay, undercarriage</p>
            <p>☐ If photos look sketchy → Don't waste time viewing</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">At the Viewing</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">1. Exterior Check (5 mins)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Paint consistency: Run your hand over panels. Bumps = repainting (accident history?)</p>
              <p>☐ Rust on body: Look under doors, wheel wells, around trunk</p>
              <p>☐ Tire tread: Use a coin. If you can see the date, tires need replacing soon (RM400–600)</p>
              <p>☐ Lights: Check all headlights, taillights, brake lights (test them)</p>
              <p>☐ Windows: Do they all roll up/down smoothly?</p>
              <p>☐ Dents/scratches: Take photos for negotiation</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">2. Interior Check (10 mins)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Smell: Musty/moldy = flood damage (walk away)</p>
              <p>☐ Upholstery: Tears, stains, odor. Cost to fix? (RM1000+)</p>
              <p>☐ Dashboard: Cracks? UV fading is normal for age</p>
              <p>☐ Steering wheel: Should feel solid, not loose</p>
              <p>☐ Seats: Can you adjust all ways? Power seats work?</p>
              <p>☐ Pedals: Check brake/clutch feel (not mushy)</p>
              <p>☐ Floor mats: Wet? (sign of leak or spill)</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">3. Engine Bay Check (5 mins)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Oil dipstick: Should be brown, not black or foamy (foamy = water in engine)</p>
              <p>☐ Coolant color: Should be pink/green, not rusty brown</p>
              <p>☐ Battery: Is it original? Corroded terminals?</p>
              <p>☐ Belts/hoses: Any visible cracks?</p>
              <p>☐ Rust spots: Slight surface rust OK. Heavy rust = neglect</p>
              <p>☐ Oil leaks: Look for drips. A small spot is normal; puddles = bad</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">4. Electrical Test (3 mins)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Radio/stereo: Does it work? (Replacement costs RM300–1000)</p>
              <p>☐ Air con: Does it blow cold? (Recharge: RM150–250)</p>
              <p>☐ Power windows: All 4 windows work?</p>
              <p>☐ Power locks: All doors lock/unlock?</p>
              <p>☐ Wipers: Do they spray water? Blades good?</p>
              <p>☐ Dashboard lights: Check ABS, engine, airbag lights (should be off)</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">5. Test Drive (15 mins)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Start cold: Engine should fire up immediately, no rough idle</p>
              <p>☐ Transmission: Smooth gear changes (no clunking for automatics)</p>
              <p>☐ Steering: Shouldn't vibrate at highway speed. Check alignment (pulls left/right?)</p>
              <p>☐ Brakes: Progressive braking, no squeaks or grinding</p>
              <p>☐ Acceleration: Smooth, no hesitation. Check engine on hills (shouldn't struggle)</p>
              <p>☐ Suspension: No clunking over bumps. Ride should be smooth</p>
              <p>☐ Listen for noises: Ticking, grinding, knocking = issues</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">6. Undercarriage Check (5 mins)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Ask seller if you can look under car</p>
              <p>☐ Check bolts: Rusted bolts on young cars = flood or neglect</p>
              <p>☐ Look for mud/dirt buildup (normal) vs. rust (bad)</p>
              <p>☐ Check exhaust pipe: Should be intact, not dragging</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
        <h3 className="font-semibold text-[#991B1B] mb-4">🚩 RED FLAGS: WALK AWAY</h3>
        <ul className="space-y-2 text-[#374151]">
          <li>❌ Musty/moldy smell (flood damage)</li>
          <li>❌ Engine oil that's foamy (water in engine)</li>
          <li>❌ Check engine light on (ignored problem)</li>
          <li>❌ Transmission clunking (expensive CVT/auto issue)</li>
          <li>❌ Major rust on undercarriage for a young car (flood/accident)</li>
          <li>❌ Seller won't let you test drive (hiding something)</li>
          <li>❌ Price is RM5k+ below market (usually means hidden damage)</li>
          <li>❌ Seller refuses JomCheck inspection (biggest red flag)</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">After Viewing</h2>
        <div className="space-y-3 text-[#374151]">
          <p>☐ If interested, order JomCheck inspection (RM99–150, 1 hour)</p>
          <p>☐ Wait for JomCheck report before negotiating</p>
          <p>☐ Use Paqar valuation + JomCheck results to negotiate</p>
          <p>☐ Don't decide emotionally. Sleep on it. Walk away if unsure.</p>
        </div>
      </section>

      <div className="text-center mt-12">
        <p className="text-[#374151] mb-4">Get armed with market data before viewing.</p>
        <a href="/" className="inline-block bg-[#064E4A] text-white px-6 py-3 rounded-lg font-semibold">Check a Car Now</a>
      </div>
    </div>
  )
}
