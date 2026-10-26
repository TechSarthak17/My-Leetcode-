import mongoose, { Schema } from 'mongoose';
const TrackedProblemSchema = new Schema({ userId:{type:String,required:true,index:true}, slug:{type:String,required:true}, title:{type:String,required:true}, difficulty:{type:String,enum:['Easy','Medium','Hard','Unknown'],default:'Unknown'}, topic:{type:String,default:'Imported'}, source:{type:String,default:'import'}, solvedAt:{type:Date}, nextReviewAt:{type:Date}, notes:{type:String,default:''} },{timestamps:true});
TrackedProblemSchema.index({userId:1,slug:1},{unique:true});
export default mongoose.models.TrackedProblem || mongoose.model('TrackedProblem',TrackedProblemSchema);
