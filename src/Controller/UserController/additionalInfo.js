const UserAdditionalInfo = require('../../Models/UserAdditionalInfo');
const User = require('../../Models/User'); // Assuming you have a User model



exports.createAdditionalInfo = async (req, res) => {
    try {

        const userId = req.user._id; 
        const { name, email,address, profilePicture } = req.body;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if additional info already exists for this user
        const existingInfo = await UserAdditionalInfo.findOne({ userId });
        if (existingInfo) {
            return res.status(400).json({ message: 'Additional info already exists for this user' });
        }

        // Create new additional info
        const additionalInfo = new UserAdditionalInfo({
            userId,
            name,
            email,
            address,
            profilePicture,
        });

        await additionalInfo.save();

        // Update user's additional info reference
        user.additionalInfo = additionalInfo._id;
        await user.save();

        res.status(201).json({ message: 'Additional info created successfully', additionalInfo });
        
    } catch (error) {
        res.status(500).json({ message: 'Error creating additional info', error: error.message });
        
    }


}



exports.getAdditionalInfo = async (req, res) => {
    try {
      const userId = req.user._id;
  
      const additionalInfo = await UserAdditionalInfo.findOne({ userId }).populate({
        path: 'userId',
        select: 'phone' // include any other fields you want from User
      });
  
      if (!additionalInfo) {
        return res.status(404).json({ message: 'Additional info not found' });
      }
  
      res.status(200).json({ additionalInfo });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching additional info', error: error.message });
    }
  };
  

  


  exports.updateAdditionalInfo = async (req, res) => {
    try {
      const userId = req.user._id;
      const { name, email, address, profilePicture } = req.body;
  
      const updated = await UserAdditionalInfo.findOneAndUpdate(
        { userId },
        { name, email, address, profilePicture },
        { new: true }
      );
  
      if (!updated) {
        return res.status(404).json({ message: 'No additional info found to update' });
      }
  
      res.status(200).json({ message: 'Additional info updated successfully', additionalInfo: updated });
    } catch (error) {
      res.status(500).json({ message: 'Error updating additional info', error: error.message });
    }
  };

  

  exports.deleteAdditionalInfo = async (req, res) => {
    try {
      const userId = req.user._id;
  
      const deleted = await UserAdditionalInfo.findOneAndDelete({ userId });
  
      if (!deleted) {
        return res.status(404).json({ message: 'No additional info found to delete' });
      }
  
      // Optional: remove reference from User model
      await User.findByIdAndUpdate(userId, { $unset: { additionalInfo: "" } });
  
      res.status(200).json({ message: 'Additional info deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting additional info', error: error.message });
    }
  };
  