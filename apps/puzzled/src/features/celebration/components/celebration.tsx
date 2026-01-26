'use client'

import { Icon } from '@sylphx/ui'
import { useEffect, useState } from 'react'

type CelebrationProps = {
	show: boolean
	onComplete?: () => void
}

// Simple, performant celebration animation
export function Celebration({ show, onComplete }: CelebrationProps) {
	const [particles, setParticles] = useState<Particle[]>([])
	const [isAnimating, setIsAnimating] = useState(false)

	useEffect(() => {
		if (show && !isAnimating) {
			setIsAnimating(true)
			// Generate particles
			const newParticles: Particle[] = Array.from({ length: 50 }, (_, i) => ({
				id: i,
				x: Math.random() * 100,
				delay: Math.random() * 0.5,
				duration: 1 + Math.random() * 1,
				color: COLORS[Math.floor(Math.random() * COLORS.length)],
				size: 6 + Math.random() * 8,
			}))
			setParticles(newParticles)

			// Clear after animation
			const timeout = setTimeout(() => {
				setParticles([])
				setIsAnimating(false)
				onComplete?.()
			}, 2500)

			return () => clearTimeout(timeout)
		}
	}, [show, isAnimating, onComplete])

	if (particles.length === 0) return null

	return (
		<div className="pointer-events-none fixed inset-0 z-toast overflow-hidden">
			{particles.map((particle) => (
				<div
					key={particle.id}
					className="celebration-particle absolute"
					style={{
						left: `${particle.x}%`,
						animationDelay: `${particle.delay}s`,
						animationDuration: `${particle.duration}s`,
						backgroundColor: particle.color,
						width: particle.size,
						height: particle.size,
					}}
				/>
			))}
			<style jsx>{`
				@keyframes fall {
					0% {
						transform: translateY(-20px) rotate(0deg);
						opacity: 1;
					}
					100% {
						transform: translateY(100vh) rotate(720deg);
						opacity: 0;
					}
				}
				.celebration-particle {
					border-radius: 2px;
					animation: fall linear forwards;
				}
			`}</style>
		</div>
	)
}

// Star burst for perfect games
export function StarBurst({ show }: { show: boolean }) {
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		if (show) {
			setVisible(true)
			const timeout = setTimeout(() => setVisible(false), 1000)
			return () => clearTimeout(timeout)
		}
	}, [show])

	if (!visible) return null

	return (
		<div className="pointer-events-none fixed inset-0 z-toast flex items-center justify-center">
			{STAR_POSITIONS.map((pos, i) => (
				<div
					key={i}
					className="star-particle absolute"
					style={
						{
							animationDelay: `${i * 0.05}s`,
							'--tx': `${pos.x}px`,
							'--ty': `${pos.y}px`,
						} as React.CSSProperties
					}
				>
					<Icon
						icon={STAR_ICONS[i % STAR_ICONS.length]}
						className="h-6 w-6 text-stat-best"
						aria-hidden="true"
					/>
				</div>
			))}
			<style jsx>{`
				@keyframes starBurst {
					0% {
						transform: translate(0, 0) scale(0);
						opacity: 1;
					}
					100% {
						transform: translate(var(--tx), var(--ty)) scale(1);
						opacity: 0;
					}
				}
				.star-particle {
					animation: starBurst 0.8s ease-out forwards;
				}
			`}</style>
		</div>
	)
}

type Particle = {
	id: number
	x: number
	delay: number
	duration: number
	color: string
	size: number
}

const COLORS = [
	'var(--celebration-green)',
	'var(--celebration-yellow)',
	'var(--celebration-blue)',
	'var(--celebration-pink)',
	'var(--celebration-orange)',
	'var(--celebration-purple)',
]

// Iconify star icons for celebration
const STAR_ICONS = ['mdi:star', 'mdi:star-four-points', 'mdi:star-shooting', 'mdi:sparkles']

const STAR_POSITIONS = [
	{ x: -100, y: -80 },
	{ x: 100, y: -80 },
	{ x: -120, y: 0 },
	{ x: 120, y: 0 },
	{ x: -100, y: 80 },
	{ x: 100, y: 80 },
	{ x: 0, y: -100 },
	{ x: 0, y: 100 },
]
