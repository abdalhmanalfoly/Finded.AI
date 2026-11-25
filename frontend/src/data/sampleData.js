// SAMPLE DATA ONLY. None of this is real. Used only when Supabase is not configured (preview mode).

export const CATEGORIES = ['Phones', 'Keys', 'Wallets and bags', 'Electronics', 'Cards and documents', 'Jewelry', 'Clothing', 'Pets', 'Other']
export const COLORS = ['Black', 'White', 'Blue', 'Red', 'Green', 'Gray', 'Brown', 'Silver', 'Gold', 'Other']

export const SAMPLE_ITEMS = [
  { id: 'l1', type: 'lost', name: 'Black Samsung phone', category: 'Phones', description: 'Samsung Galaxy with a cracked clear case and a blue lanyard.', location: 'Maadi, near the metro station', city: 'Cairo', date: '2026-11-19', time: 'Evening', color: 'Black', brand: 'Samsung', status: 'active', lat: 29.9602, lng: 31.2569 },
  { id: 'l2', type: 'lost', name: 'Brown leather wallet', category: 'Wallets and bags', description: 'Small wallet with a gold clasp.', location: 'Downtown, Tahrir Square', city: 'Cairo', date: '2026-11-18', time: 'Afternoon', color: 'Brown', brand: '', status: 'active' },
  { id: 'l3', type: 'lost', name: 'Silver laptop', category: 'Electronics', description: 'Silver 14 inch laptop in a gray sleeve.', location: 'Smouha, cafe area', city: 'Alexandria', date: '2026-11-15', time: 'Morning', color: 'Silver', brand: 'Dell', status: 'matched' },
  { id: 'l4', type: 'lost', name: 'Gold ring', category: 'Jewelry', description: 'Thin gold ring with a small stone.', location: 'Heliopolis, Korba', city: 'Cairo', date: '2026-11-10', time: 'Night', color: 'Gold', brand: '', status: 'active' },
  { id: 'l5', type: 'lost', name: 'Gray cat named Luna', category: 'Pets', description: 'Gray cat, green collar, very friendly.', location: 'Sheikh Zayed', city: 'Giza', date: '2026-11-20', time: 'Morning', color: 'Gray', brand: '', status: 'active' },
  { id: 'l6', type: 'lost', name: 'Blue backpack', category: 'Wallets and bags', description: 'Blue backpack with a university logo patch.', location: 'Cairo University gate 3', city: 'Giza', date: '2026-11-12', time: 'Afternoon', color: 'Blue', brand: 'Nike', status: 'resolved' },
  { id: 'l7', type: 'lost', name: 'House keys', category: 'Keys', description: 'Three keys on a ring with a small bell.', location: 'Zamalek, 26th of July Street', city: 'Cairo', date: '2026-11-21', time: 'Morning', color: 'Silver', brand: '', status: 'active' },
  { id: 'f1', type: 'found', name: 'Black Samsung phone', category: 'Phones', description: 'Found on a bench. Black phone with a blue strap.', location: 'Maadi, Road 9', city: 'Cairo', date: '2026-11-20', time: 'Morning', color: 'Black', brand: 'Samsung', status: 'active' },
  { id: 'f2', type: 'found', name: 'Car keys with red tag', category: 'Keys', description: 'Car key with a red fabric tag.', location: 'Nasr City, City Stars', city: 'Cairo', date: '2026-11-21', time: 'Afternoon', color: 'Black', brand: 'Toyota', status: 'active' },
  { id: 'f3', type: 'found', name: 'Silver laptop in sleeve', category: 'Electronics', description: 'Laptop handed to cafe staff.', location: 'Smouha, cafe area', city: 'Alexandria', date: '2026-11-15', time: 'Afternoon', color: 'Silver', brand: 'Dell', status: 'matched' },
  { id: 'f4', type: 'found', name: 'Student ID holder', category: 'Cards and documents', description: 'Blue holder. Owner can describe it to claim.', location: 'Dokki metro station', city: 'Giza', date: '2026-11-19', time: 'Morning', color: 'Blue', brand: '', status: 'active' },
  { id: 'f5', type: 'found', name: 'White earbuds case', category: 'Electronics', description: 'White wireless earbuds case, no brand visible.', location: 'Mohandessin, Gameat El Dowal', city: 'Giza', date: '2026-11-17', time: 'Evening', color: 'White', brand: '', status: 'active' },
  { id: 'f6', type: 'found', name: 'Brown wallet', category: 'Wallets and bags', description: 'Brown leather wallet found on a taxi seat.', location: 'Downtown', city: 'Cairo', date: '2026-11-18', time: 'Night', color: 'Brown', brand: '', status: 'active' },
]

export const SAMPLE_MATCHES = [
  { id: 'm1', lostId: 'l1', foundId: 'f1', score: 86, reasons: ['Same category: Phones', 'Same brand: Samsung', 'Same color: Black', 'Same area: Maadi', 'Found 1 day after it was lost'] },
  { id: 'm2', lostId: 'l2', foundId: 'f6', score: 71, reasons: ['Same category: Wallets and bags', 'Same color: Brown', 'Similar area: Downtown', 'Similar wording in the name'] },
  { id: 'm3', lostId: 'l7', foundId: 'f2', score: 48, reasons: ['Same category: Keys', 'Dates are 0 days apart', 'Different areas'] },
]

export const SAMPLE_ACTIVITY = [
  'Possible match found for "Black Samsung phone" (86%)',
  'You created the report "Silver laptop"',
  'Contact request received for "Brown leather wallet"',
  'Report "Blue backpack" marked as resolved',
]

export const SAMPLE_FLAGS = [
  { id: 'fl1', itemId: 'f5', reason: 'Suspicious listing', details: 'Posted many times in one hour.', status: 'open' },
  { id: 'fl2', itemId: 'l4', reason: 'Contains personal address', details: 'Description shows a full home address.', status: 'in_review' },
]

export const SAMPLE_USERS = [
  { id: 'u1', name: 'Sample User A', email: 'sample-a@example.com', role: 'user', suspended: false },
  { id: 'u2', name: 'Sample User B', email: 'sample-b@example.com', role: 'user', suspended: false },
  { id: 'u3', name: 'Sample User C', email: 'sample-c@example.com', role: 'user', suspended: true },
]
