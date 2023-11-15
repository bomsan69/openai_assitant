require('dotenv').config();
const OpenAI = require('openai');

const serectKye = process.env.OPENAI_API_KEY;

const openai = new OpenAI({apiKey:serectKye});


//create an assistant

async function main() {


    try{

         // Create a new assistant
         const assistant = await openai.beta.assistants.create({
            name:"Math Tutor Assistant",
            instructions:"You answer general knowledge questions as accurately as possible",
            model:"gpt-4-1106-preview",
        });

         // Create a new thread
         const thread = await openai.beta.threads.create();

         //Create message
         await openai.beta.threads.messages.create(thread.id,{
            role:"user",
            content:"What is the weather like in general in the city of Seoul?"
        });

        //Run
        const run = await openai.beta.threads.runs.create(thread.id,{
            assistant_id:assistant.id
        });

        //Retrieve
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id,run.id);

        while(runStatus.status !== "completed"){

            await new Promise(resolve => setTimeout(resolve, 2000));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id,run.id);
            
            console.log("status:",runStatus.status);
        
        }

        const messages = await openai.beta.threads.messages.list(thread.id);

        console.log(messages.data[0].content.text.value);











    }catch(error){
        
        console.log(error);
    }






    
}


main()
