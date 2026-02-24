/**
 * Cryptogram Puzzle Generator
 *
 * Uses seed-based selection from curated quote pool.
 * Each quote is encrypted with a unique substitution cipher.
 */

import type { CryptogramPuzzleData, CryptogramSolution } from './types'
import { createCipher, encryptText, getUniqueLetters, MAX_HINTS, reverseCipher } from './types'

// ==========================================
// Quote Pool
// ==========================================

type Quote = {
	text: string
	author: string
	category: string
}

/**
 * Curated pool of famous quotes
 * Mix of lengths and categories for variety
 */
const QUOTES: Quote[] = [
	// Inspirational
	{
		text: 'The only way to do great work is to love what you do.',
		author: 'Steve Jobs',
		category: 'Inspiration',
	},
	{
		text: 'In the middle of difficulty lies opportunity.',
		author: 'Albert Einstein',
		category: 'Inspiration',
	},
	{
		text: 'Be the change you wish to see in the world.',
		author: 'Mahatma Gandhi',
		category: 'Inspiration',
	},
	{
		text: 'The future belongs to those who believe in the beauty of their dreams.',
		author: 'Eleanor Roosevelt',
		category: 'Inspiration',
	},
	{
		text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
		author: 'Winston Churchill',
		category: 'Inspiration',
	},

	// Wisdom
	{
		text: 'The only true wisdom is in knowing you know nothing.',
		author: 'Socrates',
		category: 'Wisdom',
	},
	{
		text: 'Knowledge speaks, but wisdom listens.',
		author: 'Jimi Hendrix',
		category: 'Wisdom',
	},
	{
		text: 'The unexamined life is not worth living.',
		author: 'Socrates',
		category: 'Wisdom',
	},
	{
		text: 'We are what we repeatedly do. Excellence is not an act but a habit.',
		author: 'Aristotle',
		category: 'Wisdom',
	},
	{
		text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.',
		author: 'Ralph Waldo Emerson',
		category: 'Wisdom',
	},

	// Science
	{
		text: 'Imagination is more important than knowledge.',
		author: 'Albert Einstein',
		category: 'Science',
	},
	{
		text: 'The good thing about science is that it is true whether or not you believe in it.',
		author: 'Neil deGrasse Tyson',
		category: 'Science',
	},
	{
		text: 'Nothing in life is to be feared, it is only to be understood.',
		author: 'Marie Curie',
		category: 'Science',
	},
	{
		text: 'The important thing is not to stop questioning.',
		author: 'Albert Einstein',
		category: 'Science',
	},
	{
		text: 'Science is a way of thinking much more than it is a body of knowledge.',
		author: 'Carl Sagan',
		category: 'Science',
	},

	// Literature
	{
		text: 'It is never too late to be what you might have been.',
		author: 'George Eliot',
		category: 'Literature',
	},
	{
		text: 'The only thing we have to fear is fear itself.',
		author: 'Franklin D. Roosevelt',
		category: 'Literature',
	},
	{
		text: 'To be or not to be, that is the question.',
		author: 'William Shakespeare',
		category: 'Literature',
	},
	{
		text: 'All that glitters is not gold.',
		author: 'William Shakespeare',
		category: 'Literature',
	},
	{
		text: 'It was the best of times, it was the worst of times.',
		author: 'Charles Dickens',
		category: 'Literature',
	},

	// Life
	{
		text: 'Life is what happens when you are busy making other plans.',
		author: 'John Lennon',
		category: 'Life',
	},
	{
		text: 'In three words I can sum up everything I have learned about life: it goes on.',
		author: 'Robert Frost',
		category: 'Life',
	},
	{
		text: 'The purpose of our lives is to be happy.',
		author: 'Dalai Lama',
		category: 'Life',
	},
	{
		text: 'Life is really simple, but we insist on making it complicated.',
		author: 'Confucius',
		category: 'Life',
	},
	{
		text: 'Get busy living or get busy dying.',
		author: 'Stephen King',
		category: 'Life',
	},

	// Success
	{
		text: 'The secret of getting ahead is getting started.',
		author: 'Mark Twain',
		category: 'Success',
	},
	{
		text: 'I have not failed. I have just found ten thousand ways that will not work.',
		author: 'Thomas Edison',
		category: 'Success',
	},
	{
		text: 'It does not matter how slowly you go as long as you do not stop.',
		author: 'Confucius',
		category: 'Success',
	},
	{
		text: 'The best time to plant a tree was twenty years ago. The second best time is now.',
		author: 'Chinese Proverb',
		category: 'Success',
	},
	{
		text: 'Do what you can, with what you have, where you are.',
		author: 'Theodore Roosevelt',
		category: 'Success',
	},

	// Creativity
	{
		text: 'Creativity is intelligence having fun.',
		author: 'Albert Einstein',
		category: 'Creativity',
	},
	{
		text: 'The chief enemy of creativity is good sense.',
		author: 'Pablo Picasso',
		category: 'Creativity',
	},
	{
		text: 'Every child is an artist. The problem is how to remain an artist once we grow up.',
		author: 'Pablo Picasso',
		category: 'Creativity',
	},
	{
		text: 'You can not use up creativity. The more you use, the more you have.',
		author: 'Maya Angelou',
		category: 'Creativity',
	},
	{
		text: 'Creativity takes courage.',
		author: 'Henri Matisse',
		category: 'Creativity',
	},

	// Philosophy
	{
		text: 'I think, therefore I am.',
		author: 'Rene Descartes',
		category: 'Philosophy',
	},
	{
		text: 'The only thing I know is that I know nothing.',
		author: 'Socrates',
		category: 'Philosophy',
	},
	{
		text: 'Man is condemned to be free.',
		author: 'Jean-Paul Sartre',
		category: 'Philosophy',
	},
	{
		text: 'Happiness is not something ready made. It comes from your own actions.',
		author: 'Dalai Lama',
		category: 'Philosophy',
	},
	{
		text: 'He who has a why to live can bear almost any how.',
		author: 'Friedrich Nietzsche',
		category: 'Philosophy',
	},

	// Courage
	{
		text: 'Courage is not the absence of fear, but rather the judgment that something else is more important than fear.',
		author: 'Ambrose Redmoon',
		category: 'Courage',
	},
	{
		text: 'You gain strength, courage and confidence by every experience in which you really stop to look fear in the face.',
		author: 'Eleanor Roosevelt',
		category: 'Courage',
	},
	{ text: 'Fortune favors the bold.', author: 'Virgil', category: 'Courage' },
	{
		text: "Life shrinks or expands in proportion to one's courage.",
		author: 'Anais Nin',
		category: 'Courage',
	},
	{
		text: 'Have the courage to follow your heart and intuition.',
		author: 'Steve Jobs',
		category: 'Courage',
	},

	// Humor
	{
		text: 'I am so clever that sometimes I do not understand a single word of what I am saying.',
		author: 'Oscar Wilde',
		category: 'Humor',
	},
	{
		text: 'The only mystery in life is why the kamikaze pilots wore helmets.',
		author: 'Al McGuire',
		category: 'Humor',
	},
	{
		text: 'I refuse to join any club that would have me as a member.',
		author: 'Groucho Marx',
		category: 'Humor',
	},
	{
		text: 'Behind every great man is a woman rolling her eyes.',
		author: 'Jim Carrey',
		category: 'Humor',
	},
	{
		text: 'A day without sunshine is like, you know, night.',
		author: 'Steve Martin',
		category: 'Humor',
	},
]

/**
 * Get quote count for archive planning
 */
export function getQuoteCount(): number {
	return QUOTES.length
}

/**
 * Generate cryptogram puzzle from seed
 */
export function generateCryptogramPuzzle(seed: number): {
	puzzleData: CryptogramPuzzleData
	solution: CryptogramSolution
} {
	// Select quote based on seed
	const quoteIndex = Math.abs(seed) % QUOTES.length
	const quote = QUOTES[quoteIndex]

	// Create unique cipher for this seed
	const cipher = createCipher(seed)
	const reverse = reverseCipher(cipher)

	// Encrypt the quote
	const encryptedText = encryptText(quote.text, cipher)
	const uniqueLetters = getUniqueLetters(encryptedText)

	return {
		puzzleData: {
			encryptedText,
			author: quote.author,
			category: quote.category,
			uniqueLetters: uniqueLetters.length,
			maxHints: MAX_HINTS,
		},
		solution: {
			originalText: quote.text.toUpperCase(),
			cipher,
			reverseCipher: reverse,
		},
	}
}
