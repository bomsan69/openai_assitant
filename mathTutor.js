require('dotenv').config();
const OpenAI = require('openai');

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

async function main() {
   
    try{

        // Create a new assistant

        const assistant = await openai.beta.assistants.create({
            name:"Math Tutor Assistant",
            instructions:"You are a personal math tutor, Write and run code to answer math questions",
            tools:[{type:"code_interpreter"}],
            model:"gpt-4-1106-preview",
        })

        console.log("안녕 친구, 나는 당신의 수학 과외선생님이냐, 뭐든지 질문해 줘  ");

        // Create a new thread
        const thread = await openai.beta.threads.create();

        let keepAsking = true;

        while(keepAsking){

            const userQuestion = await askQuestion("\YOU: ");;

            await openai.beta.threads.messages.create(thread.id,{
                role:"user",
                content:userQuestion
            });

           const run = await openai.beta.threads.runs.create(thread.id,{
                assistant_id:assistant.id
            });

            let runStatus = await openai.beta.threads.runs.retrieve(thread.id,run.id);

            while(runStatus.status !== "completed"){

                await new Promise(resolve => setTimeout(resolve, 2000));
                runStatus = await openai.beta.threads.runs.retrieve(thread.id,run.id);
                
                console.log("status:",runStatus.status);
            
            }

          
            const messages = await openai.beta.threads.messages.list(thread.id);

            const lastMessaageForRun = messages.data.filter((message) => message.run_id === run.id && message.role === "assistant").pop();

            if(lastMessaageForRun){
                console.log(`Assistant:${lastMessaageForRun.content[0].text.value}\n`);
            }

            const continueAsking = await askQuestion("\n 다른 질문이 있습니까(yes/no)?" );

            keepAsking = continueAsking.toLowerCase() === "yes";


            if(!keepAsking){
               console.log("Goodbye!");
               return;
            }

            

        }

    }catch(e){
        console.log(e);
    }

}
    

main()