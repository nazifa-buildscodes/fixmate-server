import dotenv from 'dotenv';
import { connectDB, getCollections } from './src/config/db.js';

dotenv.config();

const TECH_1 = { name: 'Tariqul Islam', email: 'tech1@fixmate.com' };
const TECH_2 = { name: 'Nusrat Jahan', email: 'tech2@fixmate.com' };

const SEED_SERVICES = [
  {
    title: 'iPhone & Android OLED Screen Replacement',
    category: 'Smartphone',
    description: 'Original-grade OLED display replacement with waterproof seal restoration and 90-day service warranty.',
    image: 'https://images.unsplash.com/photo-1597740985671-2a8a3b80502e?w=800&q=80',
    basePrice: 65,
    estimatedDuration: '1-2 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianName: TECH_1.name,
    technicianEmail: TECH_1.email,
  },
  {
    title: 'Smartphone Battery & Charging Port Repair',
    category: 'Smartphone',
    description: 'Genuine battery replacement and USB-C/Lightning port micro-soldering with full battery health check.',
    image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800&q=80',
    basePrice: 35,
    estimatedDuration: '1 hour',
    serviceMode: 'Home Visit',
    serviceArea: 'Mirpur, Dhaka',
    technicianName: TECH_1.name,
    technicianEmail: TECH_1.email,
  },
  {
    title: 'Laptop Motherboard & Thermal Servicing',
    category: 'Laptop & PC',
    description: 'Complete internal dust cleaning, premium thermal paste application, and motherboard diagnostics.',
    image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?w=800&q=80',
    basePrice: 55,
    estimatedDuration: '3-4 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianName: TECH_1.name,
    technicianEmail: TECH_1.email,
  },
  {
    title: 'MacBook Keyboard & NVMe SSD Upgrade',
    category: 'Laptop & PC',
    description: 'Precision keyboard replacement, high-speed NVMe SSD upgrade, and clean OS installation.',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
    basePrice: 80,
    estimatedDuration: '2-3 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Gulshan, Dhaka',
    technicianName: TECH_2.name,
    technicianEmail: TECH_2.email,
  },
  {
    title: 'Split AC Master Servicing & Jet Wash',
    category: 'AC',
    description: 'High-pressure indoor/outdoor coil jet wash, drain pipe unclogging, and cooling efficiency check.',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
    basePrice: 40,
    estimatedDuration: '1.5 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Uttara, Dhaka',
    technicianName: TECH_2.name,
    technicianEmail: TECH_2.email,
  },
  {
    title: 'AC Gas Refill & Compressor Repair',
    category: 'AC',
    description: 'Nitrogen leak detection followed by R32/R410A refrigerant refill and capacitor inspection.',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80',
    basePrice: 75,
    estimatedDuration: '2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Bashundhara, Dhaka',
    technicianName: TECH_2.name,
    technicianEmail: TECH_2.email,
  },
  {
    title: 'Refrigerator Cooling & Thermostat Fix',
    category: 'Refrigerator',
    description: 'Fixes weak cooling, frost buildup, compressor relay failure, and door gasket leakage.',
    image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&q=80',
    basePrice: 50,
    estimatedDuration: '2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Mohammadpur, Dhaka',
    technicianName: TECH_1.name,
    technicianEmail: TECH_1.email,
  },
  {
    title: 'Inverter Fridge PCB & Gas Recharge',
    category: 'Refrigerator',
    description: 'Specialized inverter board repair and R600a eco-friendly gas charging for modern fridges.',
    image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80',
    basePrice: 70,
    estimatedDuration: '2-3 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianName: TECH_2.name,
    technicianEmail: TECH_2.email,
  },
  {
    title: 'Smart LED/OLED TV Backlight & Panel Repair',
    category: 'TV',
    description: 'No-picture sound-only fix, LED backlight strip replacement, and HDMI port repair.',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
    basePrice: 60,
    estimatedDuration: '1 day',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Mirpur, Dhaka',
    technicianName: TECH_1.name,
    technicianEmail: TECH_1.email,
  },
  {
    title: 'Front-Load Washing Machine Drum & Pump Repair',
    category: 'Washing Machine',
    description: 'Drain pump replacement, bearing noise fix, door lock sensor repair, and spin calibration.',
    image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&q=80',
    basePrice: 55,
    estimatedDuration: '2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Uttara, Dhaka',
    technicianName: TECH_2.name,
    technicianEmail: TECH_2.email,
  },
  {
    title: 'Home Electrical Wiring & Circuit Breaker Setup',
    category: 'Electrical',
    description: 'Short-circuit troubleshooting, MCB/RCCB distribution board upgrade, and earthing safety check.',
    image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',
    basePrice: 45,
    estimatedDuration: '2-3 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Banani, Dhaka',
    technicianName: TECH_1.name,
    technicianEmail: TECH_1.email,
  },
  {
    title: 'IPS / Inverter Installation & Battery Servicing',
    category: 'Electrical',
    description: 'Complete IPS wiring for lights/fans, voltage calibration, and battery maintenance.',
    image: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=800&q=80',
    basePrice: 50,
    estimatedDuration: '2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Gulshan, Dhaka',
    technicianName: TECH_2.name,
    technicianEmail: TECH_2.email,
  },
];

async function runSeed() {
  await connectDB();
  const { services } = getCollections();

  const existingCount = await services.countDocuments();
  if (existingCount >= 12) {
    console.log('Services already seeded.');
    process.exit(0);
  }

  const docs = SEED_SERVICES.map((s, idx) => ({
    ...s,
    approvalStatus: 'approved',
    isAvailable: true,
    createdAt: new Date(Date.now() - idx * 3600 * 1000 * 6),
  }));

  await services.insertMany(docs);
  console.log(`Seeded ${docs.length} approved services successfully!`);
  process.exit(0);
}

runSeed().catch((err) => {
  console.error(err);
  process.exit(1);
});
