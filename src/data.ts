import { FileItem, DuplicateGroup, BrokenFile, RenameSuggestion, FolderStructure } from './types';

export const mockFiles: FileItem[] = [
  { id: '1', name: 'vacation-photo-2024.jpg', path: '/Users/me/Pictures/', size: 4500000, type: 'image/jpeg', category: 'Images/Photos', modified: '2024-03-15', status: 'clean' },
  { id: '2', name: 'project-report.pdf', path: '/Users/me/Documents/', size: 2300000, type: 'application/pdf', category: 'Documents/PDF', modified: '2024-06-20', status: 'clean' },
  { id: '3', name: 'budget-2024.xlsx', path: '/Users/me/Documents/', size: 890000, type: 'application/xlsx', category: 'Documents/Excel', modified: '2024-01-10', status: 'clean' },
  { id: '4', name: 'screenshot-2024-06-20.png', path: '/Users/me/Downloads/', size: 1200000, type: 'image/png', category: 'Images/Screenshots', modified: '2024-06-20', status: 'pending' },
  { id: '5', name: 'song-remix.mp3', path: '/Users/me/Music/', size: 8900000, type: 'audio/mp3', category: 'Music', modified: '2024-05-12', status: 'clean' },
  { id: '6', name: 'presentation-final.pptx', path: '/Users/me/Desktop/', size: 15000000, type: 'application/pptx', category: 'Documents/Other', modified: '2024-07-01', status: 'clean' },
  { id: '7', name: 'video-tutorial.mp4', path: '/Users/me/Downloads/', size: 250000000, type: 'video/mp4', category: 'Videos', modified: '2024-04-18', status: 'clean' },
  { id: '8', name: 'backup-archive.zip', path: '/Users/me/Downloads/', size: 45000000, type: 'application/zip', category: 'Archives/ZIP', modified: '2024-02-28', status: 'clean' },
  { id: '9', name: 'app-installer.exe', path: '/Users/me/Downloads/', size: 120000000, type: 'application/exe', category: 'Software', modified: '2024-06-15', status: 'pending' },
  { id: '10', name: 'dalle-generated-art.png', path: '/Users/me/Pictures/', size: 3400000, type: 'image/png', category: 'Images/AI_Art', modified: '2024-07-05', status: 'pending' },
  { id: '11', name: 'IMG_9283.jpg', path: '/Users/me/Pictures/', size: 5600000, type: 'image/jpeg', category: 'Images/Photos', modified: '2024-03-20', status: 'pending' },
  { id: '12', name: 'meeting-notes.txt', path: '/Users/me/Documents/', size: 45000, type: 'text/plain', category: 'Documents/Text', modified: '2024-07-10', status: 'clean' },
];

export const mockDuplicates: DuplicateGroup[] = [
  {
    id: 'dup-1',
    hash: 'a1b2c3d4e5f6',
    similarity: 100,
    suggestedAction: 'delete',
    files: [
      { id: 'd1', name: 'vacation-photo.jpg', path: '/Users/me/Pictures/Vacation/', size: 4500000, type: 'image/jpeg', category: 'Images', modified: '2024-03-15', status: 'duplicate' },
      { id: 'd2', name: 'vacation-photo-copy.jpg', path: '/Users/me/Downloads/', size: 4500000, type: 'image/jpeg', category: 'Images', modified: '2024-03-16', status: 'duplicate' },
      { id: 'd3', name: 'vacation-photo (1).jpg', path: '/Users/me/Desktop/', size: 4500000, type: 'image/jpeg', category: 'Images', modified: '2024-03-15', status: 'duplicate' },
    ]
  },
  {
    id: 'dup-2',
    hash: 'f6e5d4c3b2a1',
    similarity: 100,
    suggestedAction: 'review',
    files: [
      { id: 'd4', name: 'project-report.pdf', path: '/Users/me/Documents/Work/', size: 2300000, type: 'application/pdf', category: 'Documents', modified: '2024-06-20', status: 'duplicate' },
      { id: 'd5', name: 'project-report-final.pdf', path: '/Users/me/Documents/Archive/', size: 2300000, type: 'application/pdf', category: 'Documents', modified: '2024-06-21', status: 'duplicate' },
    ]
  },
  {
    id: 'dup-3',
    hash: 'c3d4e5f6a1b2',
    similarity: 94,
    suggestedAction: 'review',
    files: [
      { id: 'd6', name: 'sunset-beach.jpg', path: '/Users/me/Pictures/Nature/', size: 3800000, type: 'image/jpeg', category: 'Images', modified: '2024-05-10', status: 'duplicate' },
      { id: 'd7', name: 'sunset-beach-edited.jpg', path: '/Users/me/Pictures/Edited/', size: 4100000, type: 'image/jpeg', category: 'Images', modified: '2024-05-11', status: 'duplicate' },
    ]
  },
  {
    id: 'dup-4',
    hash: 'e5f6a1b2c3d4',
    similarity: 100,
    suggestedAction: 'delete',
    files: [
      { id: 'd8', name: 'song-remix.mp3', path: '/Users/me/Music/', size: 8900000, type: 'audio/mp3', category: 'Music', modified: '2024-05-12', status: 'duplicate' },
      { id: 'd9', name: 'song-remix.mp3', path: '/Users/me/Downloads/Music/', size: 8900000, type: 'audio/mp3', category: 'Music', modified: '2024-05-12', status: 'duplicate' },
    ]
  },
];

export const mockBrokenFiles: BrokenFile[] = [
  { id: 'b1', file: { id: 'bf1', name: 'corrupted-image.png', path: '/Users/me/Pictures/', size: 0, type: 'image/png', category: 'Images', modified: '2024-04-01', status: 'broken' }, issue: 'Zero-byte file', severity: 'high', repairable: false },
  { id: 'b2', file: { id: 'bf2', name: 'partial-download.zip', path: '/Users/me/Downloads/', size: 12000000, type: 'application/zip', category: 'Archives', modified: '2024-06-15', status: 'broken' }, issue: 'Incomplete download (expected 45MB)', severity: 'high', repairable: false },
  { id: 'b3', file: { id: 'bf3', name: 'broken-video.mp4', path: '/Users/me/Videos/', size: 890000, type: 'video/mp4', category: 'Videos', modified: '2024-03-22', status: 'broken' }, issue: 'Corrupted video header', severity: 'medium', repairable: true },
  { id: 'b4', file: { id: 'bf4', name: 'damaged-document.pdf', path: '/Users/me/Documents/', size: 340000, type: 'application/pdf', category: 'Documents', modified: '2024-05-05', status: 'broken' }, issue: 'PDF structure damaged', severity: 'medium', repairable: true },
  { id: 'b5', file: { id: 'bf5', name: 'dead-shortcut.lnk', path: '/Users/me/Desktop/', size: 1200, type: 'application/shortcut', category: 'Other', modified: '2024-01-10', status: 'broken' }, issue: 'Broken shortcut - target not found', severity: 'low', repairable: false },
  { id: 'b6', file: { id: 'bf6', name: 'empty-folder-placeholder.txt', path: '/Users/me/Documents/', size: 0, type: 'text/plain', category: 'Documents', modified: '2024-02-14', status: 'broken' }, issue: 'Empty file', severity: 'low', repairable: false },
];

export const mockRenameSuggestions: RenameSuggestion[] = [
  { id: 'r1', originalName: 'IMG_9283.jpg', suggestedName: 'golden-retriever-running-in-park.jpg', path: '/Users/me/Pictures/', confidence: 96, aiReason: 'AI detected a golden retriever running in a green park setting', approved: false },
  { id: 'r2', originalName: 'Screenshot_2024-06-20.png', suggestedName: 'amazon-order-confirmation-screen.png', path: '/Users/me/Downloads/', confidence: 92, aiReason: 'OCR detected Amazon order confirmation page with order number', approved: false },
  { id: 'r3', originalName: 'dalle-generated-art.png', suggestedName: 'futuristic-neon-cityscape-night.png', path: '/Users/me/Pictures/', confidence: 89, aiReason: 'AI art depicting a futuristic neon-lit cityscape at night', approved: false },
  { id: 'r4', originalName: 'IMG_0001.jpg', suggestedName: 'sunset-over-ocean-beach.jpg', path: '/Users/me/Pictures/', confidence: 94, aiReason: 'Beautiful sunset over the ocean with silhouetted palm trees', approved: false },
  { id: 'r5', originalName: 'photo(3).jpg', suggestedName: 'family-dinner-christmas-2024.jpg', path: '/Users/me/Pictures/', confidence: 87, aiReason: 'Family gathering around dinner table with Christmas decorations', approved: false },
  { id: 'r6', originalName: 'scan-20240701.png', suggestedName: 'receipt-whole-foods-july-2024.png', path: '/Users/me/Downloads/', confidence: 91, aiReason: 'OCR detected Whole Foods receipt dated July 2024', approved: false },
];

export const mockFolderStructure: FolderStructure = {
  name: 'Organized Files',
  path: '/Users/me/Organized/',
  fileCount: 12847,
  size: 45600000000,
  children: [
    {
      name: 'Documents', path: '/Documents/', fileCount: 3420, size: 8900000000,
      children: [
        { name: 'PDF', path: '/Documents/PDF/', fileCount: 1200, size: 3400000000 },
        { name: 'Word', path: '/Documents/Word/', fileCount: 890, size: 2100000000 },
        { name: 'Excel', path: '/Documents/Excel/', fileCount: 650, size: 1800000000 },
        { name: 'Text', path: '/Documents/Text/', fileCount: 480, size: 340000000 },
        { name: 'Other', path: '/Documents/Other/', fileCount: 200, size: 1260000000 },
      ]
    },
    {
      name: 'Media', path: '/Media/', fileCount: 5600, size: 28900000000,
      children: [
        { name: 'Images', path: '/Media/Images/', fileCount: 3200, size: 12000000000,
          children: [
            { name: 'Photos', path: '/Media/Images/Photos/', fileCount: 2100, size: 8900000000 },
            { name: 'Screenshots', path: '/Media/Images/Screenshots/', fileCount: 600, size: 1800000000 },
            { name: 'AI_Art', path: '/Media/Images/AI_Art/', fileCount: 300, size: 900000000 },
            { name: 'Logos', path: '/Media/Images/Logos/', fileCount: 120, size: 280000000 },
            { name: 'Memes', path: '/Media/Images/Memes/', fileCount: 80, size: 120000000 },
          ]
        },
        { name: 'Videos', path: '/Media/Videos/', fileCount: 890, size: 14500000000 },
        { name: 'Music', path: '/Media/Music/', fileCount: 1200, size: 2000000000 },
        { name: 'Audio', path: '/Media/Audio/', fileCount: 310, size: 400000000 },
      ]
    },
    {
      name: 'Projects', path: '/Projects/', fileCount: 1800, size: 5600000000,
      children: [
        { name: 'Coding', path: '/Projects/Coding/', fileCount: 900, size: 2300000000 },
        { name: 'Design', path: '/Projects/Design/', fileCount: 400, size: 1800000000 },
        { name: 'School', path: '/Projects/School/', fileCount: 300, size: 890000000 },
        { name: 'Business', path: '/Projects/Business/', fileCount: 200, size: 610000000 },
      ]
    },
    {
      name: 'Archives', path: '/Archives/', fileCount: 1200, size: 1800000000,
      children: [
        { name: 'ZIP', path: '/Archives/ZIP/', fileCount: 600, size: 900000000 },
        { name: 'RAR', path: '/Archives/RAR/', fileCount: 300, size: 500000000 },
        { name: 'Backup', path: '/Archives/Backup/', fileCount: 300, size: 400000000 },
      ]
    },
    { name: 'Downloads', path: '/Downloads/', fileCount: 827, size: 400000000 },
  ]
};

export const downloadFiles = [
  { id: 'dl1', name: 'chrome-installer.exe', size: 95000000, type: 'Installer', date: '2024-07-10', category: 'Software' },
  { id: 'dl2', name: 'annual-report-2024.pdf', size: 3400000, type: 'PDF', date: '2024-07-09', category: 'Documents' },
  { id: 'dl3', name: 'profile-picture.jpg', size: 2100000, type: 'Image', date: '2024-07-08', category: 'Images' },
  { id: 'dl4', name: 'tutorial-react.mp4', size: 450000000, type: 'Video', date: '2024-07-07', category: 'Videos' },
  { id: 'dl5', name: 'node-v20-setup.msi', size: 32000000, type: 'Installer', date: '2024-07-06', category: 'Software' },
  { id: 'dl6', name: 'project-backup.zip', size: 120000000, type: 'Archive', date: '2024-07-05', category: 'Archives' },
  { id: 'dl7', name: 'invoice-march.pdf', size: 890000, type: 'PDF', date: '2024-07-04', category: 'Documents' },
  { id: 'dl8', name: 'vacation-photo.jpg', size: 5600000, type: 'Image', date: '2024-07-03', category: 'Images' },
  { id: 'dl9', name: 'podcast-episode-42.mp3', size: 67000000, type: 'Audio', date: '2024-07-02', category: 'Audio' },
  { id: 'dl10', name: 'design-assets.rar', size: 230000000, type: 'Archive', date: '2024-07-01', category: 'Archives' },
  { id: 'dl11', name: 'vscode-update.exe', size: 89000000, type: 'Installer', date: '2024-06-30', category: 'Software' },
  { id: 'dl12', name: 'resume-2024.docx', size: 450000, type: 'Document', date: '2024-06-29', category: 'Documents' },
];

export const storageData = [
  { name: 'Images', value: 12, color: '#6366f1' },
  { name: 'Videos', value: 14.5, color: '#06b6d4' },
  { name: 'Documents', value: 8.9, color: '#10b981' },
  { name: 'Music', value: 2.0, color: '#f59e0b' },
  { name: 'Archives', value: 1.8, color: '#ef4444' },
  { name: 'Projects', value: 5.6, color: '#8b5cf6' },
  { name: 'Other', value: 1.2, color: '#64748b' },
];

export const scanHistory = [
  { date: '2024-07-10', filesScanned: 12847, duplicates: 23, broken: 6, timeSpent: 45 },
  { date: '2024-07-09', filesScanned: 12500, duplicates: 18, broken: 4, timeSpent: 38 },
  { date: '2024-07-08', filesScanned: 12100, duplicates: 31, broken: 8, timeSpent: 52 },
  { date: '2024-07-07', filesScanned: 11800, duplicates: 15, broken: 3, timeSpent: 35 },
  { date: '2024-07-06', filesScanned: 11500, duplicates: 27, broken: 5, timeSpent: 42 },
  { date: '2024-07-05', filesScanned: 11200, duplicates: 12, broken: 2, timeSpent: 30 },
  { date: '2024-07-04', filesScanned: 10900, duplicates: 20, broken: 7, timeSpent: 48 },
];
