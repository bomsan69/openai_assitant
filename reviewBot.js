require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});


const serectKye = process.env.OPENAI_API_KEY;

const openai = new OpenAI({apiKey:serectKye});


async function askQuestion(question) {

    return new Promise((resolve, reject) => {
        readline.question(question, (answer) => {
            resolve(answer);
        })
    })

}

async function upload_file(path) {


    const file = await openai.files.create({
        file: fs.createReadStream(path),
        purpose: "assistants",
      });


    return file;
    

}

//id: 'file-YHoL6Q4ry0nCRGdpFc7tMS4E',

async function checkFile(file_id) {

    const list = await openai.files.list();

    const file = list.data.find((file) => file.id === file_id);

    if(file){
        return true
    }else{
        return false
    }
    
}

async function print_messages_from_thread(run_id,thread_id) {

    console.log("print_messages_from_thread",thread_id);

    const messages = await openai.beta.threads.messages.list(thread_id);

    const lastMessaageForRun = messages.data.filter((message) => message.run_id === run_id && message.role === "assistant").pop();

    if(lastMessaageForRun){

        console.log(`Assistant:${lastMessaageForRun.content[0].text.value}\n`);


    
    }else{

        console.log("no messages");
    }


}

const instructions=`You are a helpful customer care assistant. 
Your role is to assist answers to restaurant reviews written by customers.
You should never use your own knowledge to answer questions.
`

async function main() {

    let file_id ='file-tAj2SyS7Uuy51yMzBicUjr17';

    try {

        const isFIle = await checkFile(file_id);

        console.log("isFIle",isFIle);

      

        if(!isFIle){

             const file = await upload_file('./csvjson.json');

             let file_id = file.id;

        }

        


        const assistant = await openai.beta.assistants.create({
            name:"Review Assistant",
            instructions:instructions,
            tools:[{type:"retrieval"}],
            model:"gpt-4-1106-preview",
            file_ids:[file_id]
        })
        
        console.log("assistant id",assistant.id)

       

        const assistant_id = assistant.id

        const thread = await openai.beta.threads.create();

        console.log("thread id",thread.id);

        let keepAsking = true;

        while(keepAsking){

            const userQuestion = await askQuestion("\nReview: ");;

            await openai.beta.threads.messages.create(thread.id,{
                role:"user",
                content:userQuestion
            });

           const run = await openai.beta.threads.runs.create(thread.id,{
                assistant_id:assistant_id
            });

            let runStatus = await openai.beta.threads.runs.retrieve(thread.id,run.id);

            while(runStatus.status !== "completed"){

                await new Promise(resolve => setTimeout(resolve, 2000));
                runStatus = await openai.beta.threads.runs.retrieve(thread.id,run.id);
                
                console.log("status:",runStatus.status);
            
            }


            await print_messages_from_thread(run.id,thread.id);
          
           
            const continueAsking = await askQuestion("다른 질문이 있습니까(yes/no)?");

            keepAsking = continueAsking.toLowerCase() === "yes";

            if(!keepAsking){
               console.log("Goodbye!");
               return;
            }
        
        
        }

        
        
     
        
    } catch (error) {

        console.log(error);
        
    }

    
    
}


main();