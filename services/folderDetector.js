
const detectFolder = (text, filename) => {
  const lowerText = text.toLowerCase();
  const lowerFilename = filename.toLowerCase();
  const combinedText = `${lowerText} ${lowerFilename}`;

  // Payment-related keywords
  const paymentKeywords = [
    'payment', 'invoice', 'receipt', 'transaction', 'paid', 'amount',
    'refund', 'purchase', 'order', 'bank', 'upi', 'credit card',
    'debit', 'bill', 'rupees', 'dollar', 'price', 'cost', 'total',
    'subtotal', 'tax', 'gst', 'paypal', 'razorpay', 'stripe'
  ];

  // Job-related keywords
  const jobKeywords = [
    'job', 'employment', 'offer letter', 'salary', 'appointment',
    'contract', 'resume', 'cv', 'interview', 'position', 'role',
    'designation', 'employee', 'hr', 'human resource', 'joining',
    'work', 'career', 'linkedin', 'recruitment'
  ];

  // Education-related keywords
  const educationKeywords = [
    'education', 'school', 'college', 'university', 'degree',
    'certificate', 'course', 'admission', 'exam', 'result',
    'grade', 'transcript', 'diploma', 'semester', 'academic',
    'student', 'enrollment', 'scholarship', 'tuition'
  ];

  // Travel-related keywords
  const travelKeywords = [
    'travel', 'flight', 'ticket', 'booking', 'hotel', 'reservation',
    'visa', 'passport', 'airport', 'boarding', 'itinerary',
    'destination', 'trip', 'vacation', 'tourism', 'airlines',
    'train', 'bus', 'cab', 'uber', 'ola'
  ];

  // Health-related keywords
  const healthKeywords = [
    'health', 'medical', 'doctor', 'hospital', 'clinic', 'prescription',
    'medicine', 'report', 'test', 'diagnosis', 'treatment', 'insurance',
    'patient', 'appointment', 'vaccination', 'pharmacy', 'lab'
  ];

  // Receipt-related keywords
  const receiptKeywords = [
    'receipt', 'bill', 'invoice', 'purchased', 'bought', 'shop',
    'store', 'retail', 'amazon', 'flipkart', 'shopping', 'delivery'
  ];

  // Personal-related keywords
  const personalKeywords = [
    'id', 'identification', 'license', 'driving', 'aadhar', 'pan',
    'voter', 'identity', 'birth certificate', 'address proof'
  ];

  // Count keyword matches
  const scores = {
    payments: countMatches(combinedText, paymentKeywords),
    jobs: countMatches(combinedText, jobKeywords),
    education: countMatches(combinedText, educationKeywords),
    travel: countMatches(combinedText, travelKeywords),
    health: countMatches(combinedText, healthKeywords),
    receipts: countMatches(combinedText, receiptKeywords),
    personal: countMatches(combinedText, personalKeywords)
  };

  // Find folder with highest score
  let maxScore = 0;
  let detectedFolder = 'general';

  for (const [folder, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedFolder = folder;
    }
  }

  // If no strong match, return general
  if (maxScore < 2) {
    return 'general';
  }

  return detectedFolder;
};

const countMatches = (text, keywords) => {
  let count = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      count++;
    }
  }
  return count;
};

module.exports = { detectFolder };