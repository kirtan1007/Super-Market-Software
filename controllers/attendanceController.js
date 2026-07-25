const Attendance = require('../models/Attendance');
const { logActivity } = require('../middleware/auth');

// Helper to get formatted YYYY-MM-DD date
const getFormattedTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Private
exports.getAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find().populate('employee', 'name username role').sort({ checkIn: -1 });
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clock-In employee (Manual or automatic)
// @route   POST /api/attendance/checkin
// @access  Private
exports.checkIn = async (req, res) => {
  try {
    const userId = req.body.employee || req.user._id;
    const todayStr = getFormattedTodayDate();

    // Check if check-in already exists for today
    let record = await Attendance.findOne({ employee: userId, date: todayStr });
    if (record) {
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }

    record = await Attendance.create({
      employee: userId,
      date: todayStr,
      checkIn: new Date(),
      status: 'Present'
    });

    await logActivity(req, 'Attendance Check-in', `Employee checked in for today: ${todayStr}`);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clock-Out employee
// @route   POST /api/attendance/checkout
// @access  Private
exports.checkOut = async (req, res) => {
  try {
    const userId = req.body.employee || req.user._id;
    const todayStr = getFormattedTodayDate();

    const record = await Attendance.findOne({ employee: userId, date: todayStr });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Check-in record not found for today' });
    }

    if (record.checkOut) {
      return res.status(400).json({ success: false, message: 'Already checked out today' });
    }

    record.checkOut = new Date();
    await record.save();

    await logActivity(req, 'Attendance Check-out', `Employee checked out for today: ${todayStr}`);
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete an attendance record
// @route   DELETE /api/attendance/:id
// @access  Private
exports.deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    await record.deleteOne();
    await logActivity(req, 'Delete Attendance', `Attendance record for date ${record.date} deleted`);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
